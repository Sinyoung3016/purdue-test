import {Base64} from './base64';

export const decodeBleString = value => {
  if (!value) {
    return '';
  }
  return Base64.decode(value);
};

export const encodeBleString = value => {
  if (!value) {
    return '';
  }
  return Base64.encode(value);
};
