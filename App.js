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

let drowsyStatus = false;
let sleepSec = 0;
let audioName = 'good';
let ing = false;

const urlDemo = 'https://demo.thingsboard.io/api/v1/5HQeXnFXZ3IbSCXO3EyM/rpc';

const manager = new BleManager();

export default function App() {
  const [rec, setRec] = useState(false);
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
      url: urlDemo,
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
      url: urlDemo,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'genRandSec', params: {}},
    }).then(async response => {
      sleepSec = response.data;
      console.log('1. GAME : response sec :', sleepSec);
      await new Promise(r => setTimeout(r, sleepSec * 1000));
    });
  }

  async function isResponseFast(time, hr, sp02) {
    //return string=filename
    await axios({
      url: urlDemo,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'isResponseFast', params: [time, hr, sp02]},
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
      console.log('start');
      const subscription = manager.onStateChange(state => {
        if (state === 'PoweredOn') {
          manager.startDeviceScan(null, null, async (error, device) => {
            if (error) {
              console.log('error', error);
              return;
            }
            if (device.name === 'TestBLE') {
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

              bioChar.monitor((err, bio) => {
                if (err) {
                  console.log('err', err);
                }

                //bio data 전송
                const bioData = decodeBleString(bio.value).split(':');
                hr = bioData[0];
                sp02 = bioData[1];
                console.log(hr, sp02);

                if (!drowsyStatus) {
                  isDrowsy(hr, sp02);
                }
              }); //bio

              while (true) {
                await new Promise(r => setTimeout(r, 4000));

                if (drowsyStatus && !ing) {
                  ing = true;

                  genRandSec();

                  await vibeChar
                    .writeWithResponse(encodeBleString('1'))
                    .then(() => {
                      console.log('2. GAME : VibeAction');
                    });

                  RNSoundLevel.start();
                  setRec(true);
                  const startTime = new Date();

                  RNSoundLevel.onNewFrame = async data => {
                    if (data.rawValue >= 4000) {
                      await new Promise(r => setTimeout(r, 100)).then(
                        async () => {
                          const duringTime = new Date() - startTime;
                          RNSoundLevel.stop();
                          //await new Promise(r => setTimeout(r, 2000));
                          isResponseFast(duringTime, hr, sp02);
                          console.log('3. GAME : Sound', duringTime, hr, sp02);
                          SoundPlayer.playSoundFile(audioName, 'mp3');
                          ing = false;
                          drowsyStatus = false;
                          setRec(false);
                        },
                      );
                    }
                  };
                } //if
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
        marginTop: 100,
        marginLeft: 50,
        borderRadius: 40,
        backgroundColor: '#9dbad1',
        width: 300,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {rec ? (
        <Text style={{fontSize: 50}}>!!!!소리 질러!!!!</Text>
      ) : (
        <Text style={{fontSize: 20}}>진동이 울리면 '와!'를 외쳐주세요</Text>
      )}
    </View>
  );
}
