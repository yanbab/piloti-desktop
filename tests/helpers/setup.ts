// The unit tests run against the browser demo's seeded VFS, as `piloti-web.tsx` sets it up.
import { demoVfsSeed } from "@/lib/engine-web/vfs-seed";
import { setVfsSeed } from "@/lib/engine-web/web-vfs";

setVfsSeed(demoVfsSeed);
