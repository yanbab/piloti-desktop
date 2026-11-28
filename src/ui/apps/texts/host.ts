import { parseIniText, serializeIniText } from "@/core/config/ini";
import {
  createModuleDocumentHost,
  readModuleText,
  type createAppModuleHost,
  type ModuleFiles,
} from "@/platform/shared/app-module-host";
import { _ } from "@/core/util/i18n";
import type { TextsHost } from "@/ui/apps/texts/texts-host";

const TEXTS_INI = ".config/piloti-texts/settings.ini";
/** Where the settings were before the app was renamed. */
const FORMER_INI = ".config/piloti/notepad.ini";

/**
 * TextsHost for a Domicile app module: a document host, plus the editor's
 * preferences, loaded before it mounts since it reads them synchronously.
 */
export async function createDomicileEditorHost(
  module: Awaited<ReturnType<typeof createAppModuleHost>>,
  files: ModuleFiles,
): Promise<TextsHost> {
  const readText = (path: string) => readModuleText(files, path);
  const [documents, textsRaw] = await Promise.all([
    createModuleDocumentHost(module, files, () => _("Untitled")),
    readText(TEXTS_INI).then((raw) => raw ?? readText(FORMER_INI)),
  ]);
  const texts = textsRaw ? parseIniText(textsRaw) : {};
  return {
    ...documents,
    defaultNewFilePath: (name) => `${documents.userDir("DESKTOP")}/${name}`,
    readEditorPrefs: () => texts.Editor ?? {},
    writeEditorPrefs: (values) => {
      texts.Editor = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]));
      void files.createDir(".config/piloti-texts").catch(() => {});
      void files.write(TEXTS_INI, serializeIniText(texts)).catch(() => {});
    },
    onPrintFocused: () => () => {},
  };
}
