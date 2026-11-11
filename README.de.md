<div align="center">

<img src="docs/images/logo.png" alt="Scriba" width="112" />

# Scriba

**Ein quelloffener, pluginbasierter WYSIWYG-Markdown-Editor**

Die Markdown-Syntax verschwindet hinter dem gesetzten Ergebnis: Nur die Zeile unter dem Cursor zeigt ihren Quelltext, alles andere wird so dargestellt, wie es später aussieht.

[![CI](https://github.com/hui139/scriba/actions/workflows/ci.yml/badge.svg)](https://github.com/hui139/scriba/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hui139/scriba?label=release)](https://github.com/hui139/scriba/releases/latest)
[![License](https://img.shields.io/github/license/hui139/scriba)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-4b5563)](#download)

[English](README.en.md) · [简体中文](README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

</div>

![Scriba-Screenshot](docs/images/screenshot.png)

## Download

<div align="center">

[![Scriba herunterladen](https://img.shields.io/badge/HERUNTERLADEN-Scriba-6d28d9?style=for-the-badge&logo=github)](https://github.com/hui139/scriba/releases/latest)

**[⬇ Neueste Version herunterladen](https://github.com/hui139/scriba/releases/latest)**

</div>

Alle Versionen inklusive älterer Installer: [releases](https://github.com/hui139/scriba/releases)

| Plattform | Datei | Installation |
| --- | --- | --- |
| **Windows** 10/11 (x64) | `Scriba-<Version>-win-x64.exe` | Installer ausführen |
| **macOS** (Apple Silicon) | `Scriba-<Version>-mac-arm64.dmg` | Öffnen und Scriba in „Programme" ziehen |
| **macOS** (Intel) | `Scriba-<Version>-mac-x64.dmg` | Ebenso |
| **Linux** (x64) | `Scriba-<Version>-linux-x86_64.AppImage` | `chmod +x`, dann starten |

> **Die Installer sind nicht codesigniert.** Beim ersten Start warnt das Betriebssystem:
>
> - **Windows**: SmartScreen meldet „Windows hat den PC geschützt" → „Weitere Informationen" → „Trotzdem ausführen".
> - **macOS**: „Entwickler kann nicht überprüft werden" → unter „Systemeinstellungen → Datenschutz & Sicherheit" erlauben oder die App mit Rechtsklick → „Öffnen" starten.
> - **Linux**: Zuerst `chmod +x` ausführen.
>
> Die Installer werden von GitHub Actions aus dem Quellcode dieses Repositories gebaut ([release.yml](.github/workflows/release.yml)). Der Ablauf lässt sich nachvollziehen, alternativ kann selbst gebaut werden.

## Funktionen

**Schreiben**

- Überschriften, fett, kursiv, durchgestrichen, markiert, unterstrichen, hoch-/tiefgestellt, Inline-Code, Links, Bilder, Zitate, Listen, Aufgabenlisten, Trennlinien, Fußnoten, `[TOC]` und YAML-Frontmatter werden beim Tippen direkt gesetzt
- Tabellen direkt bearbeiten: Zeilen und Spalten hinzufügen, Ausrichtung per Kontextmenü, Spaltenbreite durch Ziehen ändern (Doppelklick setzt zurück)
- Screenshots und Bilddateien einfügen oder hineinziehen; sie landen in `assets/` und werden verlinkt, inklusive Größenangabe `=200x`
- Listen laufen mit Enter weiter, Marker verschwinden mit Backspace, markierter Text wird beim Einfügen einer URL zum Link
- Suche im gesamten Arbeitsbereich, Gliederungs-Seitenleiste, Tabs, zuletzt geöffnete Dateien, Quelltextmodus
- Suchen und Ersetzen mit Groß-/Kleinschreibung, ganzem Wort, regulären Ausdrücken und Alles ersetzen
- Fokusmodus und Schreibmaschinenmodus

**Satz und Export**

- KaTeX-Formeln (inline `$...$`, als Block `$$...$$`) und Mermaid-Diagramme werden live gesetzt
- Export nach HTML, PDF, Word, reinem Text, PNG, LaTeX und EPUB (mehrstufiges Inhaltsverzeichnis aus den Überschriften)
- Relative Bildpfade werden beim Export eingebettet; EPUB legt die Bilder ins Archiv
- Ordner-Export kopiert Markdown und Bilddateien gemeinsam
- Export-Vorlagen: CSS in `<userData>/export-templates/` ablegen

**Anpassung**

- Sechs mitgelieferte Themes (Standard: Violet Night, abgeleitet aus den Farben des App-Icons), dazu eigenes CSS und Plugin-Themes
- Oberfläche skalierbar von 85 % bis 140 %, Dokumenttextgröße separat einstellbar
- Alle Tastenkürzel frei belegbar; bei Konflikten wird die alte Belegung freigegeben
- Oberflächensprachen: Englisch und vereinfachtes Chinesisch, per Plugin erweiterbar

**Erweiterbarkeit**

- JavaScript-Plugins registrieren Befehle, Tastenkürzel, Statusleisten-Einträge, Seitenleisten-Panels, Codeblock-Renderer, Themes und Sprachen
- Der Plugin-Marktplatz findet Plugins über das GitHub-Topic `scriba-plugin` – ohne zentralen Index

## Aus dem Quellcode bauen

Benötigt **Node.js 20+** und npm 10+.

```bash
git clone https://github.com/hui139/scriba.git
cd scriba
npm ci
npm run dev
```

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsmodus mit Hot Reload |
| `npm run build` | Nach `out/` bauen |
| `npm run typecheck` | TypeScript-Typprüfung |
| `npm test` | Alle Tests (Unit- und UI-Smoke-Tests) |
| `npm run test:compat` | Unit-Tests: Versionskompatibilität und Manifest-Lokalisierung |
| `npm run smoke` | UI-Smoke-Test gegen die echte Anwendung |
| `npm run dist` | Installer für die aktuelle Plattform nach `release/` bauen |
| `npm run icons` | Alle Icons aus dem Ausgangsbild neu erzeugen |

<details>
<summary>Festlandchina: langsame oder fehlschlagende Downloads</summary>

```bash
npm install --registry=https://registry.npmmirror.com

# PowerShell: Electron-Binärdatei über einen Mirror laden
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install --registry=https://registry.npmmirror.com
```

Eine Meldung `libpng warning: iCCP: known incorrect sRGB profile` beim Start stammt aus dem in Electron enthaltenen Chromium, nicht aus dieser Anwendung oder ihren Icons, und beeinträchtigt die Funktion nicht. Mit `SCRIBA_SHOW_ELECTRON_WARNINGS=1` erscheint die ungefilterte Ausgabe.

</details>

## Dokumentation

| Dokument | Inhalt |
| --- | --- |
| [Projektüberblick](docs/PROJECT.md) · [English](docs/PROJECT.en.md) | Designentscheidungen, Architektur, Interna (Chinesisch) |
| [Plugin-API](docs/PLUGIN_API.md) · [English](docs/PLUGIN_API.en.md) | Vollständige Referenz und Beispiele (Chinesisch/Englisch) |
| [Plugin-Spezifikation](docs/PLUGIN_SPEC.md) | Namens-, Manifest-, Veröffentlichungs- und Prüfregeln (Chinesisch) |
| [Marktplatz](docs/MARKETPLACE.md) | GitHub-Suche und JSON-Index als zwei Wege (Chinesisch) |
| [Mitwirken](CONTRIBUTING.md) | Entwicklungsablauf und Commit-Konventionen (Chinesisch) |

## Plugins

Ein Plugin liegt in `<userData>/plugins/<plugin-id>/` und enthält eine `manifest.json` sowie einen CommonJS-Einstiegspunkt, der `activate(scriba)` exportiert:

```js
module.exports.activate = (scriba) => {
  scriba.commands.register({
    id: 'my-plugin.hello',
    name: 'Say Hello',
    run: () => scriba.ui.showToast('Hello from my plugin!')
  })
}
```

Die vollständige API steht in [docs/PLUGIN_API.md](docs/PLUGIN_API.md). Im **Plugin-Manager** der Anwendung lassen sich Plugins aktivieren, deaktivieren und aus einem Ordner installieren.

Plugins lassen sich verteilen: Ein öffentliches Repository mit dem Topic `scriba-plugin` erscheint im Plugin-Marktplatz der Anwendung. Anforderungen stehen in [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md).

## Projektstruktur

```
src/
  main/             Electron-Hauptprozess (Fenster, Dateisystem, Plugins, Export, Update-Prüfung)
  preload/          contextBridge-API
  renderer/         React-Renderer
    src/editor/     CodeMirror-Editor und Live-Vorschau
    src/plugins/    Plugin-Laufzeit und Registry der Beitragspunkte
    src/components/ UI-Komponenten
    src/markdown/   Markdown zu HTML für den Export
plugins/            Mitgelieferte Plugins (Lesezeit, Sprachlabel für Codeblöcke)
scripts/            Starter, Icon-Build, Tests
docs/               Dokumentation
```

## Sicherheit

Plugins sind gewöhnliches JavaScript im Renderer mit denselben Rechten wie der Editor. **Installieren Sie nur Plugins, denen Sie vertrauen.** Context Isolation ist aktiv, die Content-Security-Policy enthält kein `unsafe-eval`; Plugin-Einstiegspunkte werden als Blob-Modul geladen und benötigen nur `script-src blob:`.

Plugins sind derzeit weder signiert noch in einer Sandbox – eine bekannte Einschränkung, dokumentiert in [docs/PLUGIN_SPEC.md](docs/PLUGIN_SPEC.md#九已知限制).

## Roadmap

- [ ] Versionsverlauf
- [ ] Zusammenarbeit und Cloud-Synchronisierung (optional)

Bereits umgesetzte Funktionen stehen in den [Releases](https://github.com/hui139/scriba/releases) und der Commit-Historie.

## Mitwirken

Issues und Pull Requests sind willkommen. Bitte zuerst [CONTRIBUTING.md](CONTRIBUTING.md) lesen und vor dem Absenden sicherstellen, dass `npm run typecheck`, `npm test` und `npm run build` durchlaufen. Die CI prüft dies unter Windows, macOS und Linux.

## Lizenz

[MIT](LICENSE) © Scriba Contributors

Das App-Icon ist eigenes Material des Projekts, urheberrechtlich beim jeweiligen Autor und nicht von der MIT-Lizenz abgedeckt.
