# 0059: Stable number identities and compact language curricula

Date: 2026-10-31. Status: accepted for the requested number-practice redesign.

The number setup page offers a target language, independently selectable
0–10, 11–100 and 101–1000 bands, and an exhaustive option for 11–100. It opens
ordinary study after durable local installation. It has no independent preview
or practice-round state.

The curriculum lives in the portable domain package. Every supported target
has an explicit profile for standalone cardinal numbers. French uses exactly
the agreed 11 basic numbers plus 24 examples from 11–100. Profiles for languages
with independently lexicalized small numbers, including Hindi and Urdu,
retain that vocabulary rather than applying an English decade sample. These
profiles target cardinal formation; noun agreement, counters, ordinal forms,
regional variants and additional numeral systems are outside this exercise.

A new managed deck key `local:numbers:v3:<targetLocale>` owns stable
`number:<value>` card keys. Question: Latin digits. Answer: the same digits
and the existing canonical target-language spelling. Each rating always belongs
to the same number. Existing scheduler, review-event and synchronization rules
are unchanged.

Narrowing the selection suspends excluded existing number cards instead of
deleting them. Expanding restores the same identities and review states. A
manual suspension within an unchanged selection remains; explicitly selecting
an excluded number again enables it. The existing managed installer writes the
deck/settings and all card changes in one durable local transaction. Settings
are encoded in deck tags and survive export/restore; a device preference merely
remembers which target was last opened.

The old v2 collection assigned changing values to stable competency slots.
Its ratings cannot truthfully be copied to individual number cards. It stays
available with its existing keys, content-generation path and history. New
practice neither deletes it nor repurposes its ratings. The new flow is local;
the parked API path remains compatible and is not a second curriculum authority
for newly created v3 decks.

This choice makes the requested fixed minimal curriculum reproducible and
keeps existing history intact. Additional transfer examples may later receive
their own stable cards; changing the meaning of a previously rated card is not
an acceptable way to add them.
