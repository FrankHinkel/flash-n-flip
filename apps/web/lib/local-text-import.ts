export type LocalTextImportCard = {
  front: string;
  back: string;
};

const parseDelimitedLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) {
    throw new Error(
      "Eine Textzeile enthält ein nicht geschlossenes Anführungszeichen.",
    );
  }
  values.push(value.trim());
  return values;
};

export const parseLocalDelimitedCards = (
  input: string,
): LocalTextImportCard[] => {
  const lines = input
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim());
  const delimiter = lines.some((line) => line.includes("\t")) ? "\t" : ",";
  return lines.map((line, index) => {
    const fields = parseDelimitedLine(line, delimiter);
    if (fields.length < 2 || !fields[0] || !fields[1]) {
      throw new Error(
        `Zeile ${String(index + 1)} benötigt Vorder- und Rückseite.`,
      );
    }
    return { front: fields[0], back: fields.slice(1).join(delimiter) };
  });
};
