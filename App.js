import React, {useEffect} from 'react';
import axios from 'axios';
import {Text, TouchableOpacity} from 'react-native';
import {BleManager} from 'react-native-ble-plx';

const msg = {
  bpm: 100,
};

const manager = new BleManager();

export default function App() {
  useEffect(() => {
    const subscription = manager.onStateChange(state => {
      if (state === 'PoweredOn') {
        scanAndConnect();
        console.log('power on');
        subscription.remove();
      }
    }, true);
  });

  function scanAndConnect() {
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log('error', error);
        return;
      }
      if (device.name === 'TestBLE') {
        manager.stopDeviceScan();
        console.log('discover', device.id);

        device.connect().then(device => {
          console.log('connect success');
        });
      }
    });
  }
  function goForAxios() {
    //curl -v -X POST -d "{\"bmp\": 80}\" http://192.168.2.208:8080/api/v1/$ACCESS_TOKEN/telemetry --header "Content-Type:application/json"
    const response = axios({
      url: 'http://192.168.2.208:8080/api/v1/UXdKE72SZUOxvFinh9c0/telemetry',
      method: 'post',
      header: {'Content-Type': 'application/json'},
      data: msg,
    })
      .then(response => {
        console.log('response status :', response.status);
      })
      .catch(error => {
        console.log(error);
      });
  }
  return (
    <TouchableOpacity
      style={{
        marginTop: 100,
        marginLeft: 50,
        borderRadius: 40,
        backgroundColor: '#9dbad1',
        width: 300,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPress={goForAxios}>
      <Text style={{fontSize: 20}}>Send "BPM:100" Data to Server</Text>
    </TouchableOpacity>
  );
}
