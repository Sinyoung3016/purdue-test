import React, {useEffect, useState} from 'react';
import {Text, View, Alert} from 'react-native';

import {BleManager} from 'react-native-ble-plx';
import RNSoundLevel from 'react-native-sound-level';
import SoundPlayer from 'react-native-sound-player';

import {encodeBleString, decodeBleString} from './base64';
import {isDrowsy, genRandSec, isResponseFast} from './server';

let service = null;
let bioChar = null;
let vibeChar = null;

let hr = '0';
let sp02 = '0';
let startTime = null;

let drowsyStatus = false;
let audioName = 'wakeup';
let ing = false;

const serverUrl = 'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/rpc';
const serverInitUrl =
  'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/telemetry';

const manager = new BleManager();

export default function App() {
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(false);

  function game() {
    let twomins = 0;
    if (drowsyStatus && !ing) {
      ing = true;

      console.log('====> GAME START');

      genRandSec(serverUrl).then(async response => {
        sleepSec = response.data;
        console.log('> 1. GAME : genRandSec');
        await new Promise(r => setTimeout(r, sleepSec * 1000));
      });

      RNSoundLevel.start().then(async () => {
        await vibeChar.writeWithResponse(encodeBleString('1'));
        startTime = new Date();
        console.log('> 2. GAME : VibeAction');
      });

      RNSoundLevel.onNewFrame = async data => {
        if (twomins++ == 8) {
          // timeout for 2 secs
          console.log('> 3. GAME : Timeout');
          await new Promise(r => setTimeout(r, 100)).then(async () => {
            RNSoundLevel.stop();
            ing = false;
          });
        }
        if (data.rawValue >= 4000) {
          // good
          const duringTime = new Date() - startTime;
          console.log('> 3. GAME : Response Time :', duringTime);
          await new Promise(r => setTimeout(r, 100)).then(async () => {
            RNSoundLevel.stop();
            ing = false;
          });
          isResponseFast(serverUrl, hr, sp02, duringTime).then(response => {
            drowsyStatus = false;
            audioName = response.data;
            SoundPlayer.playSoundFile(audioName, 'mp3');
          });
        }
      }; //run RNSoundLevel
    }
  }

  useEffect(() => {
    Alert.alert(
      'Warning',
      'Turn on Bluetooth and GPS \nThen click the OK button below',
      [{text: 'OK', onPress: () => setReload(true)}],
    );
  }, []);

  useEffect(() => {
    if (!reload) return;

    console.log('BLE > start');
    const subscription = manager.onStateChange(state => {
      if (state === 'PoweredOn') {
        manager.startDeviceScan(null, null, async (error, device) => {
          if (error) {
            console.log('error', error);
            return;
          }
          if (device.name === 'CroffleBLE') {
            console.log('BLE > detected');

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
                isDrowsy(serverUrl, hr, sp02).then(response => {
                  drowsyStatus = response.data;
                  console.log('SEND BIO DATA');
                });
              }
            });

            while (1) {
              await new Promise(r => setTimeout(r, 4000));
              game();
            }
          }
        });
        console.log('power on');
        subscription.remove();
      }
    }, true);
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
