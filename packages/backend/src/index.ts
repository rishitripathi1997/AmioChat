/** @amiochat/backend — Lambda handlers for REST and WebSocket APIs */
export { handler as restHandler } from './rest/handler';
export { handler as wsHandler } from './ws/handler';
export { handleRestRequest, type RestRequest, type RestResponse } from './rest/router';
export { seedUserProfile } from './db/memory';
export { storeUploadedMedia, getUploadedMedia } from './services/media';
