import axios from 'axios';

export async function isDrowsy(url, hr, sp02) {
  //return true/false
  return await axios({
    url,
    method: 'post',
    header: {'Content-Type': 'application/json'},
    data: {method: 'isDrowsy', params: [hr, sp02]},
  });
}

export async function genRandSec(url) {
  //return sec
  return await axios({
    url,
    method: 'post',
    header: {'Content-Type': 'application/json'},
    data: {method: 'genRandSec', params: {}},
  });
}

export async function isResponseFast(url, hr, sp02, time) {
  //return string=filename
  return await axios({
    url,
    method: 'post',
    header: {'Content-Type': 'application/json'},
    data: {method: 'isResponseFast', params: [hr, sp02, time]},
  });
}
