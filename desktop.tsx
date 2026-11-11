/// <reference types="@domicile-desktop/react/elements" />
import "./src/styles/globals.css";
import { mount } from "@domicile-desktop/react/mount";
import { PilotiShell } from "./src/components/shell/PilotiShell";

export const Desktop = PilotiShell;
export const Shell = mount(PilotiShell);
