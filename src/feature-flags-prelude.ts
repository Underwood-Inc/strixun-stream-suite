/**
 * Must load before any module that may call fetch — installs the flag merge hook.
 */
import { bootstrapUiFeatureFlags, installFeatureFlagsFetchHook } from "./stores/ui-feature-flags";

installFeatureFlagsFetchHook();
bootstrapUiFeatureFlags();