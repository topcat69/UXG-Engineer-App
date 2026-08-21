-- The 5th theme was redesigned from a light-graphite "Slate" into a dark
-- navy-background theme and renamed to match (see lib/theme/themes.ts) —
-- carry forward anyone who'd already picked the old one rather than
-- silently reverting them to Light (themeClassName falls back to "" for
-- an unrecognized stored value).
update users set theme = 'navy' where theme = 'slate';
