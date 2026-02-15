/**
 * Unit tests for NNG Transport Layer and Protocol.
 */

import {
  HEADER_SIZE,
  MSG_INVOKE_REQUEST,
  MSG_INVOKE_RESPONSE,
  MSG_REGISTER_LOCAL_REQUEST,
  MSG_REGISTER_LOCAL_RESPONSE,
  getMsgID,
  getResponseMsgId,
  isRequest,
  isResponse,
  msgIdString,
  newMessage,
  parseMessage,
  putMsgID,
} from '../src/protocol';

describe('Protocol', () => {
  describe('newMessage', () => {
    it('should create a message with correct header', () => {
      const msgType = MSG_INVOKE_REQUEST;
      const reqId = 12345;
      const body = Buffer.from('test payload');

      const message = newMessage(msgType, reqId, body);

      expect(message.length).toBe(HEADER_SIZE + body.length);
      expect(message[0]).toBe(0x01); // Version
    });
  });

  describe('parseMessage', () => {
    it('should parse a message correctly', () => {
      const msgType = MSG_REGISTER_LOCAL_REQUEST;
      const reqId = 999;
      const body = Buffer.from('hello world');

      const message = newMessage(msgType, reqId, body);
      const parsed = parseMessage(message);

      expect(parsed.version).toBe(0x01);
      expect(parsed.msgId).toBe(msgType);
      expect(parsed.reqId).toBe(reqId);
      expect(parsed.body.toString()).toBe(body.toString());
    });
  });

  describe('getResponseMsgId', () => {
    it('should return correct response message ID', () => {
      expect(getResponseMsgId(MSG_INVOKE_REQUEST)).toBe(MSG_INVOKE_RESPONSE);
      expect(getResponseMsgId(MSG_REGISTER_LOCAL_REQUEST)).toBe(MSG_REGISTER_LOCAL_RESPONSE);
    });
  });

  describe('isRequest', () => {
    it('should identify request messages', () => {
      expect(isRequest(MSG_INVOKE_REQUEST)).toBe(true);
      expect(isRequest(MSG_REGISTER_LOCAL_REQUEST)).toBe(true);
      expect(isRequest(MSG_INVOKE_RESPONSE)).toBe(false);
      expect(isRequest(MSG_REGISTER_LOCAL_RESPONSE)).toBe(false);
    });
  });

  describe('isResponse', () => {
    it('should identify response messages', () => {
      expect(isResponse(MSG_INVOKE_RESPONSE)).toBe(true);
      expect(isResponse(MSG_REGISTER_LOCAL_RESPONSE)).toBe(true);
      expect(isResponse(MSG_INVOKE_REQUEST)).toBe(false);
      expect(isResponse(MSG_REGISTER_LOCAL_REQUEST)).toBe(false);
    });
  });

  describe('msgIdString', () => {
    it('should return human-readable message ID string', () => {
      expect(msgIdString(MSG_INVOKE_REQUEST)).toBe('InvokeRequest');
      expect(msgIdString(MSG_INVOKE_RESPONSE)).toBe('InvokeResponse');
      expect(msgIdString(MSG_REGISTER_LOCAL_REQUEST)).toBe('RegisterLocalRequest');
      expect(msgIdString(0xffffff)).toBe('Unknown(0xffffff)');
    });
  });

  describe('putMsgID and getMsgID', () => {
    it('should encode and decode message ID correctly', () => {
      const msgId = 0x030101;
      const encoded = putMsgID(msgId);
      const decoded = getMsgID(encoded);

      expect(decoded).toBe(msgId);
    });
  });
});
