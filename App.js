import React, {useEffect, useState} from 'react';
import axios from 'axios';
import {Text, View, Alert} from 'react-native';
import {BleManager} from 'react-native-ble-plx';
import {Base64} from './base64';
import RNSoundLevel from 'react-native-sound-level';
import SoundPlayer from 'react-native-sound-player';

let service = null;
let bioChar = null;
let vibeChar = null;

let hr = '0';
let sp02 = '0';
let startTime = null;

let drowsyStatus = false;
let sleepSec = 0;
let audioName = 'wakeup';
let ing = false;

//const serverUrl = 'https://demo.thingsboard.io/api/v1/5HQeXnFXZ3IbSCXO3EyM/rpc';
const serverUrl = 'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/rpc';

const manager = new BleManager();

export default function App() {
  const [rec, setRec] = useState(false);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(false);

  const decodeBleString = value => {
    if (!value) {
      return '';
    }
    return Base64.decode(value);
  };

  const encodeBleString = value => {
    if (!value) {
      return '';
    }
    return Base64.encode(value);
  };

  async function isDrowsy(hr, sp02) {
    //return true/false
    await axios({
      url: serverUrl,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'isDrowsy', params: [hr, sp02]},
    }).then(response => {
      drowsyStatus = response.data;
      console.log('SEND : response drowsy status :', drowsyStatus);
    });
  }

  async function genRandSec() {
    //return sec
    await axios({
      url: serverUrl,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'genRandSec', params: {}},
    }).then(async response => {
      sleepSec = response.data;
      console.log('1. GAME : response sec :', sleepSec);
      await new Promise(r => setTimeout(r, sleepSec * 1000));
    });
  }

  //변수순서 바꾸기 필수
  async function isResponseFast(time, hr, sp02) {
    //return string=filename
    await axios({
      url: serverUrl,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'isResponseFast', params: [hr, sp02, time]},
    }).then(response => {
      audioName = response.data;
      console.log('4. GAME : response isResponseFast :', audioName);
    });
  }

  useEffect(() => {
    Alert.alert('주의', 'Bluetooth와 GPS를 키고, 아래 확인 버튼을 눌러주세요', [
      {text: '확인', onPress: () => setReload(true)},
    ]);
  }, []);

  useEffect(() => {
    if (reload) {
      //console.log('start');
      const subscription = manager.onStateChange(state => {
        if (state === 'PoweredOn') {
          manager.startDeviceScan(null, null, async (error, device) => {
            if (error) {
              console.log('error', error);
              return;
            }
            if (device.name === 'CroffleBLE') {
              console.log('detected');
              manager.stopDeviceScan();

              const connectedDevice = await device.connect();

              const allServicesAndCharacteristics =
                await connectedDevice.discoverAllServicesAndCharacteristics();
              service = (await allServicesAndCharacteristics.services())[2];

              const char = await service.characteristics();
              bioChar = char[0];
              vibeChar = char[1];

              await bioChar.read();
              setReady(true);

              bioChar.monitor((err, bio) => {
                if (err) {
                  console.log('err', err);
                }

                //bio data 전송
                const bioData = decodeBleString(bio.value).split(':');
                hr = bioData[0];
                sp02 = bioData[1];

                if (!drowsyStatus) {
                  isDrowsy(hr, sp02);
                }
              }); //bio

              while (true) {
                await new Promise(r => setTimeout(r, 4000));

                let twomins = 0;
                if (drowsyStatus && !ing) {
                  ing = true;
                  genRandSec();

                  RNSoundLevel.start().then(async () => {
                    await vibeChar.writeWithResponse(encodeBleString('1'));
                    startTime = new Date();
                    console.log('2. GAME : VibeAction');
                  });

                  RNSoundLevel.onNewFrame = async data => {
                    console.log(twomins);
                    if (++twomins == 9) {
                      console.log('3. GAME : Timeout');
                      await new Promise(r => setTimeout(r, 100)).then(
                        async () => {
                          RNSoundLevel.stop();
                          ing = false;
                        },
                      );
                    }

                    if (data.rawValue >= 4000) {
                      const duringTime = new Date() - startTime;
                      await new Promise(r => setTimeout(r, 100)).then(
                        async () => {
                          RNSoundLevel.stop();
                          ing = false;
                        },
                      );
                      isResponseFast(duringTime, hr, sp02).then(() => {
                        SoundPlayer.playSoundFile(audioName, 'mp3');
                      });
                      console.log('3. GAME : Sound', duringTime);
                    }
                  };
                } //if
                setRec(false);
              } //while
            }
          });
          console.log('power on');
          subscription.remove();
        }
      }, true);
    }
  }, [reload]);

  return (
    <View
      style={{
        marginTop: 250,
        marginLeft: 50,
        width: 300,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {reload ? (
        <Text style={{fontSize: 30}}>
          {ready
            ? '진동이 울리면, "와"를 외쳐주세요'
            : '연결중 입니다. \n 잠시만 기다려주세요.'}
        </Text>
      ) : null}
    </View>
  );
}
