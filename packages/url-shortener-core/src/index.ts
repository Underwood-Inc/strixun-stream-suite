export * from './molecules/shortenerPublicHostsCatalog.js';
export * from './molecules/resolvePublicHostKey.js';
export * from './molecules/composePublicShortUrl.js';
export * from './molecules/mergeViewIntoLinkAggregate.js';
export * from './ports/LinkAggregateStore.js';
export * from './ports/LinkViewEventSink.js';
export * from './recipes/recordLinkView.js';
export * from './plugs/memory/InMemoryLinkAggregateStore.js';
export * from './plugs/memory/InMemoryLinkViewEventSink.js';
export * from './adapters/KvLinkAggregateStore.js';
export * from './adapters/AnalyticsEngineLinkViewSink.js';

export {
  readPreferredPublicHostKey,
  writePreferredPublicHostKey,
} from './persistence/publicHostPreference.js';

export const UI_SHORTENER_PUBLIC_HOST_KEY = 'ui_shortener_public_host';