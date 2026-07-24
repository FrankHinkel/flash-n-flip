# ADR 0003: Immutable community revisions

Status: accepted

Public decks point to immutable approved revisions. Editing public content
creates a new draft and requires a new admin decision. Subscriptions refer to a
public deck and selected revision, while personal review history remains owned
by the learner.

No API route may make content public without an admin-authored audit event.
