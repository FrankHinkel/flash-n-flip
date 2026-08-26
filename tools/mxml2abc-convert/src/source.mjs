import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import yauzl from "yauzl";

const maximumArchiveBytes = 16 * 1024 * 1024;
const maximumXmlBytes = 16 * 1024 * 1024;
const maximumArchiveEntries = 64;
const maximumExpandedBytes = 64 * 1024 * 1024;

const safeArchivePath = (value) =>
  value.length > 0 &&
  value.length <= 512 &&
  !value.includes("\\") &&
  !path.posix.isAbsolute(value) &&
  !value.split("/").includes("..");

const readZipEntry = (archive, entry) =>
  new Promise((resolve, reject) => {
    archive.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error("MXL entry could not be opened"));
        return;
      }
      const chunks = [];
      let length = 0;
      stream.on("data", (chunk) => {
        length += chunk.length;
        if (length > maximumXmlBytes) {
          stream.destroy(new Error("MXL MusicXML entry is too large"));
          return;
        }
        chunks.push(chunk);
      });
      stream.once("error", reject);
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  });

const collectMxlEntries = (buffer) =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, autoClose: false, validateEntrySizes: true },
      (error, archive) => {
        if (error || !archive) {
          reject(error ?? new Error("MXL archive could not be opened"));
          return;
        }
        const entries = new Map();
        let entryCount = 0;
        let expandedBytes = 0;
        const fail = (cause) => {
          archive.close();
          reject(cause);
        };
        archive.once("error", fail);
        archive.once("end", () => {
          archive.close();
          resolve(entries);
        });
        archive.on("entry", async (entry) => {
          try {
            entryCount += 1;
            expandedBytes += entry.uncompressedSize;
            if (entryCount > maximumArchiveEntries)
              throw new Error("MXL archive contains too many entries");
            if (expandedBytes > maximumExpandedBytes)
              throw new Error("MXL archive expands beyond the safe limit");
            if (!safeArchivePath(entry.fileName))
              throw new Error("MXL archive contains an unsafe path");
            if ((entry.generalPurposeBitFlag & 0x1) !== 0)
              throw new Error("Encrypted MXL entries are not supported");
            if (entries.has(entry.fileName))
              throw new Error("MXL archive contains duplicate paths");
            const relevant =
              entry.fileName === "META-INF/container.xml" ||
              /\.(?:musicxml|xml)$/iu.test(entry.fileName);
            if (relevant && !entry.fileName.endsWith("/")) {
              if (entry.uncompressedSize > maximumXmlBytes)
                throw new Error("MXL MusicXML entry is too large");
              entries.set(entry.fileName, await readZipEntry(archive, entry));
            }
            archive.readEntry();
          } catch (cause) {
            fail(cause);
          }
        });
        archive.readEntry();
      },
    );
  });

const decodeXml = (buffer) => {
  const value = buffer.toString("utf8").replace(/^\uFEFF/u, "");
  if (value.includes("\uFFFD"))
    throw new Error("MusicXML must use valid UTF-8 encoding");
  if (/<!ENTITY\b/iu.test(value) || /<!DOCTYPE[^>]*\[/iu.test(value))
    throw new Error("MusicXML entities and internal DTD subsets are forbidden");
  if (!/<score-(?:partwise|timewise)\b/iu.test(value))
    throw new Error("Input does not contain a MusicXML score root");
  return value.replace(/<!DOCTYPE[^>]*>/iu, "");
};

const containerRootPath = (container) => {
  const match = container.match(
    /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/iu,
  );
  if (!match || !safeArchivePath(match[1]))
    throw new Error("MXL container does not name a safe MusicXML root file");
  return match[1];
};

export async function readMusicXmlInput(inputFile) {
  const inputPath = path.resolve(inputFile);
  const fileStat = await stat(inputPath);
  if (!fileStat.isFile()) throw new Error("Input must be a regular file");
  const extension = path.extname(inputPath).toLowerCase();
  if (![".xml", ".musicxml", ".mxl"].includes(extension))
    throw new Error("Input must use .xml, .musicxml or .mxl");
  const maximumBytes =
    extension === ".mxl" ? maximumArchiveBytes : maximumXmlBytes;
  if (fileStat.size <= 0 || fileStat.size > maximumBytes)
    throw new Error("MusicXML input is empty or exceeds the safe size limit");
  const sourceBuffer = await readFile(inputPath);
  if (extension !== ".mxl") {
    return {
      inputPath,
      inputType: "musicxml",
      sourceBuffer,
      xml: decodeXml(sourceBuffer),
      rootPath: path.basename(inputPath),
    };
  }

  const entries = await collectMxlEntries(sourceBuffer);
  const containerBuffer = entries.get("META-INF/container.xml");
  if (!containerBuffer)
    throw new Error("MXL archive is missing META-INF/container.xml");
  const rootPath = containerRootPath(containerBuffer.toString("utf8"));
  const xmlBuffer = entries.get(rootPath);
  if (!xmlBuffer)
    throw new Error("MXL archive is missing its declared MusicXML score");
  return {
    inputPath,
    inputType: "mxl",
    sourceBuffer,
    xml: decodeXml(xmlBuffer),
    rootPath,
  };
}
