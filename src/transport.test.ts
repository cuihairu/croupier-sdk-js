/**
 * Unit tests for NNG Transport Layer and Protocol.
 */

import {
  HEADER_SIZE,
  MSG_INVOKE_REQUEST,
  MSG_INVOKE_RESPONSE,
  MSG_REGISTER_LOCAL_REQUEST,
  MSG_REGISTER_LOCAL_RESPONSE,
  MSG_START_JOB_REQUEST,
  MSG_START_JOB_RESPONSE,
  MSG_CANCEL_JOB_REQUEST,
  MSG_CANCEL_JOB_RESPONSE,
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

    it('should create a message with empty body', () => {
      const msgType = MSG_REGISTER_LOCAL_REQUEST;
      const reqId = 1;
      const body = Buffer.alloc(0);

      const message = newMessage(msgType, reqId, body);

      expect(message.length).toBe(HEADER_SIZE);
      expect(message[0]).toBe(0x01);
    });

    it('should handle large request ID', () => {
      const msgType = MSG_INVOKE_REQUEST;
      const reqId = 0xFFFFFFFF; // Max uint32
      const body = Buffer.from('test');

      const message = newMessage(msgType, reqId, body);
      const parsed = parseMessage(message);

      expect(parsed.reqId).toBe(reqId);
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

    it('should parse message with empty body', () => {
      const msgType = MSG_INVOKE_REQUEST;
      const reqId = 123;
      const body = Buffer.alloc(0);

      const message = newMessage(msgType, reqId, body);
      const parsed = parseMessage(message);

      expect(parsed.body.length).toBe(0);
    });
  });

  describe('getResponseMsgId', () => {
    it('should return correct response message ID', () => {
      expect(getResponseMsgId(MSG_INVOKE_REQUEST)).toBe(MSG_INVOKE_RESPONSE);
      expect(getResponseMsgId(MSG_REGISTER_LOCAL_REQUEST)).toBe(MSG_REGISTER_LOCAL_RESPONSE);
      expect(getResponseMsgId(MSG_START_JOB_REQUEST)).toBe(MSG_START_JOB_RESPONSE);
      expect(getResponseMsgId(MSG_CANCEL_JOB_REQUEST)).toBe(MSG_CANCEL_JOB_RESPONSE);
    });
  });

  describe('isRequest', () => {
    it('should identify request messages', () => {
      expect(isRequest(MSG_INVOKE_REQUEST)).toBe(true);
      expect(isRequest(MSG_REGISTER_LOCAL_REQUEST)).toBe(true);
      expect(isRequest(MSG_START_JOB_REQUEST)).toBe(true);
      expect(isRequest(MSG_CANCEL_JOB_REQUEST)).toBe(true);
      expect(isRequest(MSG_INVOKE_RESPONSE)).toBe(false);
      expect(isRequest(MSG_REGISTER_LOCAL_RESPONSE)).toBe(false);
    });
  });

  describe('isResponse', () => {
    it('should identify response messages', () => {
      expect(isResponse(MSG_INVOKE_RESPONSE)).toBe(true);
      expect(isResponse(MSG_REGISTER_LOCAL_RESPONSE)).toBe(true);
      expect(isResponse(MSG_START_JOB_RESPONSE)).toBe(true);
      expect(isResponse(MSG_CANCEL_JOB_RESPONSE)).toBe(true);
      expect(isResponse(MSG_INVOKE_REQUEST)).toBe(false);
      expect(isResponse(MSG_REGISTER_LOCAL_REQUEST)).toBe(false);
    });
  });

  describe('msgIdString', () => {
    it('should return human-readable message ID string', () => {
      expect(msgIdString(MSG_INVOKE_REQUEST)).toBe('InvokeRequest');
      expect(msgIdString(MSG_INVOKE_RESPONSE)).toBe('InvokeResponse');
      expect(msgIdString(MSG_REGISTER_LOCAL_REQUEST)).toBe('RegisterLocalRequest');
      expect(msgIdString(MSG_START_JOB_REQUEST)).toBe('StartJobRequest');
      expect(msgIdString(MSG_START_JOB_RESPONSE)).toBe('StartJobResponse');
      expect(msgIdString(MSG_CANCEL_JOB_REQUEST)).toBe('CancelJobRequest');
      expect(msgIdString(MSG_CANCEL_JOB_RESPONSE)).toBe('CancelJobResponse');
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

    it('should handle max message ID', () => {
      const msgId = 0xFFFFFF;
      const encoded = putMsgID(msgId);
      const decoded = getMsgID(encoded);

      expect(decoded).toBe(msgId);
    });

    it('should handle min message ID', () => {
      const msgId = 0x000000;
      const encoded = putMsgID(msgId);
      const decoded = getMsgID(encoded);

      expect(decoded).toBe(msgId);
    });
  });

  describe('HEADER_SIZE', () => {
    it('should be 8 bytes', () => {
      expect(HEADER_SIZE).toBe(8);
    });
  });
});
