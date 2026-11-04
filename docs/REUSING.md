# Running this portal for another event

The portal is built so that a town hall next March, or next year's summit, is a
config change rather than a code change.

## The short version

1. Copy `config/event.json` and edit it.
2. Put the new attendee list in `config/attendees.csv`.
3. Run `npm run db:reset`.

That is it for the schedule, the resources, the branding and the Slido link.

## What to change in event.json

| Section              | What it controls                                                       |
| -------------------- | ---------------------------------------------------------------------- |
| `event`              | Name, dates, venue, time zone, the one portal URL behind every QR code |
| `branding`           | Logo, font, brand colours, and the light and dark themes               |
| `features`           | Which modules are switched on for this event                           |
| `integrations.slido` | The Slido link and code, or turn it off entirely                       |
| `days`               | The agenda. Each day has a date, a label and its sessions              |
| `speakers`           | Everyone a session can point at, by id                                 |
| `resources`          | The take away links                                                    |
| `surprise`           | The countdown target and its label, or leave it out                    |

Save the file and refresh the browser. If anything is wrong, the portal lists
each problem in plain English with the field name, and the rules are in
`src/lib/event-schema.ts`.

## Pointing at a different config file

To keep several events side by side, set this in `.env.local`:

```
EVENT_CONFIG_PATH=config/town-hall-2027.json
ATTENDEES_CSV_PATH=config/town-hall-2027.csv
```

Both files can live outside the repository if you prefer, using a full path.

## Switching modules on and off

`features` in the config decides what exists. A small town hall might want:

```json
"features": {
  "schedule": true,
  "resources": true,
  "checkIn": true,
  "feedback": true,
  "bigScreen": false,
  "qa": false,
  "polls": false
}
```

Anything switched off does not appear in the navigation and its pages return
"not found". Only switch on a module that has actually been built; the flags
for unbuilt modules are there so the config does not need changing later.

## Theming it

The look is not fixed. `branding.themes.light` and `branding.themes.dark` are
colour tokens, and every screen uses them. To match a new event's slide deck,
change the hex values and nothing else.

`branding.defaultTheme` sets what phones use and `branding.bigScreenTheme` sets
what the projector uses, so the ballroom screen can run dark while phones run
light.

## What is not config

Anything that changes the behaviour of a module rather than its content. If a
new event needs per session check in, or a different feedback question set,
that is code. The config deliberately does not try to be a form builder.
