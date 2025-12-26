/**
 * Chat Signaling Router
 * 
 * Routes all requests to appropriate handlers
 * Uses shared encryption suite for automatic response encryption
 */

import { handleHealth } from '../handlers/health.js';
import { handleCreatePartyRoom, handleGetPartyRooms, handleInviteToPartyRoom } from '../handlers/party.js';
import { handleCreateRoom, handleGetAnswer, handleGetOffer, handleGetRooms, handleHeartbeat, handleJoinRoom, handleLeaveRoom, handleSendAnswer, handleSendOffer } from '../handlers/signaling.js';
import { getCorsHeaders } from '../utils/cors.js';

/**
 * Helper to wrap handlers with automatic encryption
 * Uses shared encryption suite from serverless/shared/encryption
 */
async function wrapWithEncryption(handlerResponse, request) {
  // Check if response should be encrypted (has JWT token and is OK)
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (token && token.length >= 10 && handlerResponse.ok) {
    try {
      const contentType = handlerResponse.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const { encryptWithJWT } = await import('@strixun/api-framework');
        const responseData = await handlerResponse.json();
        const encrypted = await encryptWithJWT(responseData, token);
        
        const headers = new Headers(handlerResponse.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Encrypted', 'true');
        
        return new Response(JSON.stringify(encrypted), {
          status: handlerResponse.status,
          statusText: handlerResponse.statusText,
          headers: headers,
        });
      }
    } catch (error) {
      console.error('Failed to encrypt response:', error);
    }
  }
  
  return handlerResponse;
}

/**
 * Route requests to appropriate handlers
 */
export async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Health check
    if (path === '/health' || path === '/') {
      return handleHealth(request, env);
    }

    // Signaling endpoints
    if (path === '/signaling/create-room' && request.method === 'POST') {
      const response = await handleCreateRoom(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path === '/signaling/join-room' && request.method === 'POST') {
      const response = await handleJoinRoom(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path === '/signaling/offer' && request.method === 'POST') {
      const response = await handleSendOffer(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path.startsWith('/signaling/offer/') && request.method === 'GET') {
      const response = await handleGetOffer(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path === '/signaling/answer' && request.method === 'POST') {
      const response = await handleSendAnswer(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path.startsWith('/signaling/answer/') && request.method === 'GET') {
      const response = await handleGetAnswer(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path === '/signaling/heartbeat' && request.method === 'POST') {
      const response = await handleHeartbeat(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path === '/signaling/rooms' && request.method === 'GET') {
      const response = await handleGetRooms(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path === '/signaling/leave' && request.method === 'POST') {
      const response = await handleLeaveRoom(request, env);
      return await wrapWithEncryption(response, request);
    }

    // Party room endpoints (opt-in room splitting)
    if (path === '/signaling/create-party-room' && request.method === 'POST') {
      const response = await handleCreatePartyRoom(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path.startsWith('/signaling/party-rooms/') && request.method === 'GET') {
      const response = await handleGetPartyRooms(request, env);
      return await wrapWithEncryption(response, request);
    }

    if (path.startsWith('/signaling/party-room/') && path.endsWith('/invite') && request.method === 'POST') {
      const response = await handleInviteToPartyRoom(request, env);
      return await wrapWithEncryption(response, request);
    }

    // Not found
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

