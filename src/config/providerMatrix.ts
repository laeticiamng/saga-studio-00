/**
 * Provider Matrix — Legacy re-export for backward compatibility.
 * 
 * All provider logic has been refactored into src/config/providers/.
 * Import from "@/config/providers" for new code.
 * 
 * @deprecated Use `import { ... } from "@/config/providers"` instead.
 */

export {
  type ProjectMode,
  type QualityTier,
  type OutputNature,
  type RenderTarget,
  type ProviderRule,
  type ProviderResolution,
  PROVIDER_MATRIX,
  resolveProvider,
  getRenderTarget,
  isBrowserRenderAllowed,
} from "./providers";
