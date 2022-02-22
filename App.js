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
//const serverStartUrl = 'https://demo.thingsboard.io/api/v1/5HQeXnFXZ3IbSCXO3EyM/telemetry';
const serverUrl = 'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/rpc';
const serverStartUrl =
  'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/telemetry';

const manager = new BleManager();

export default function App() {
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

  async function isDrowsy(url, hr, sp02) {
    //return true/false
    await axios({
      url,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'isDrowsy', params: [hr, sp02]},
    }).then(response => {
      drowsyStatus = response.data;
      //drowsyStatus = true;
      console.log('====> SEND : response drowsy status :', drowsyStatus);
    });
  }

  async function genRandSec(url) {
    //return sec
    await axios({
      url,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'genRandSec', params: {}},
    }).then(async response => {
      sleepSec = response.data;
      console.log('> 1. GAME : response sec :', sleepSec);
      await new Promise(r => setTimeout(r, sleepSec * 1000));
    });
  }

  async function isResponseFast(url, time, hr, sp02) {
    //return string=filename
    await axios({
      url,
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: {method: 'isResponseFast', params: [hr, sp02, time]},
    }).then(response => {
      audioName = response.data;
    });
  }

  useEffect(() => {
    Alert.alert(
      'Warning',
      'Turn on Bluetooth and GPS \nThen click the OK button below',
      [{text: 'OK', onPress: () => setReload(true)}],
    );
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
                  isDrowsy(serverUrl, hr, sp02);
                }
              }); //bio

              while (1) {
                await new Promise(r => setTimeout(r, 4000));

                let twomins = 0;
                if (drowsyStatus && !ing) {
                  console.log('====> GAME START');
                  ing = true;
                  genRandSec(serverUrl);

                  RNSoundLevel.start().then(async () => {
                    await vibeChar.writeWithResponse(encodeBleString('1'));
                    startTime = new Date();
                    console.log('> 2. GAME : VibeAction');
                  });

                  RNSoundLevel.onNewFrame = async data => {
                    //console.log(twomins);
                    if (++twomins == 9) {
                      console.log('> 3. GAME : Timeout');
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
                      isResponseFast(serverUrl, duringTime, hr, sp02).then(
                        () => {
                          drowsyStatus = false;
                          SoundPlayer.playSoundFile(audioName, 'mp3');
                          console.log('> 3. GAME : Result', audioName);
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
        marginTop: 300,
        marginLeft: 50,
        width: 300,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {reload ? (
        <Text style={{fontSize: 30}}>
          {ready ? 'Shout when it vibrates' : 'Connecting... \n Please Wait.'}
        </Text>
      ) : null}
    </View>
  );
}
