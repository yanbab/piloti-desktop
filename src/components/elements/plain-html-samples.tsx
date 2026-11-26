import * as React from "react";
import {
  GroupedFormGroup,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import { _ } from "@/lib/core/i18n";

/** Elements written as plain HTML: the preview is made from the very string
 *  shown below it, so the two can't drift apart. */
const SAMPLES: [title: string, html: string][] = [
  [
    "Window",
    `<section class="ui-window" style="flex-direction: column; height: 180px">
  <header class="ui-window-titlebar">
    <div class="ui-window-title">Hello</div>
  </header>
  <div class="ui-window-content" style="padding: 16px">Hello world</div>
</section>`,
  ],
  [
    "Buttons",
    `<button class="ui-button">Save</button>
<button class="ui-button" data-variant="secondary">Cancel</button>
<button class="ui-button" data-variant="tinted">Tinted</button>
<button class="ui-button" data-variant="destructive">Delete</button>
<button class="ui-button" data-variant="secondary" disabled>Disabled</button>`,
  ],
  [
    "Switch and checkbox",
    `<span class="ui-switch" data-slot="switch" role="switch" aria-checked="true" data-checked>
  <span class="ui-switch-thumb" data-slot="switch-thumb" data-checked></span>
</span>
<span class="ui-switch" data-slot="switch" role="switch" aria-checked="false" data-unchecked>
  <span class="ui-switch-thumb" data-slot="switch-thumb" data-unchecked></span>
</span>
<span class="ui-checkbox" role="checkbox" aria-checked="true" data-checked>
  <span class="ui-checkbox-indicator">
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6.5 5 9l5-6"/></svg>
  </span>
</span>`,
  ],
  [
    "Text field",
    `<input class="ui-input" placeholder="Name" style="max-width: 200px">`,
  ],
  [
    "Segmented control",
    `<div class="ui-segmented" data-slot="segmented">
  <button class="ui-segmented-item" data-slot="segmented-item" aria-pressed="true">List</button>
  <button class="ui-segmented-item" data-slot="segmented-item" aria-pressed="false">Grid</button>
</div>`,
  ],
  [
    "Grouped form",
    `<div class="ui-form" data-slot="grouped-form">
  <section class="ui-form-section" data-slot="grouped-form-section">
    <div class="ui-form-group" data-slot="grouped-form-group">
      <div class="ui-form-row" data-slot="grouped-form-row">
        <div class="ui-form-row-title" data-slot="grouped-form-row-title">Name</div>
        <div class="ui-form-row-control">Piloti</div>
      </div>
      <div class="ui-form-row" data-slot="grouped-form-row">
        <div class="ui-form-row-title" data-slot="grouped-form-row-title">Version</div>
        <div class="ui-form-row-control">0.10</div>
      </div>
    </div>
  </section>
</div>`,
  ],
  [
    "Sidebar",
    `<aside class="ui-sidebar bg-ui-sidebar" style="width: 180px">
  <nav class="ui-sidebar-nav" data-slot="sidebar-nav" style="padding-top: 8px">
    <button class="ui-sidebar-item" data-slot="sidebar-item" data-selected>
      <span class="ui-sidebar-label">Recents</span>
    </button>
    <button class="ui-sidebar-item" data-slot="sidebar-item">
      <span class="ui-sidebar-label">Documents</span>
    </button>
  </nav>
</aside>`,
  ],
  [
    "Menu",
    `<div class="ui-menu ui-material-menu" role="menu" style="width: 200px">
  <div class="ui-menu-item" role="menuitem">Open<span class="ui-menu-shortcut">⌘O</span></div>
  <div class="ui-menu-item" role="menuitem" data-highlighted>Rename…</div>
  <div class="ui-menu-separator" role="separator"></div>
  <div class="ui-menu-item" role="menuitem" data-disabled>Move to Trash</div>
</div>`,
  ],
];

export function PlainHtmlSections() {
  return (
    <>
      {SAMPLES.map(([title, html]) => (
        <GroupedFormSection key={title}>
          <GroupedFormSectionTitle>{`${_("HTML")} · ${title}`}</GroupedFormSectionTitle>
          <GroupedFormGroup className="px-0">
            {/* Constant strings above: never user content. */}
            <div
              className="flex flex-wrap items-center gap-2 p-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <pre className="overflow-x-auto border-t border-ui-separator p-3 font-mono text-ui-footnote select-text">
              {html}
            </pre>
          </GroupedFormGroup>
        </GroupedFormSection>
      ))}
    </>
  );
}
