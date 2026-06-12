import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

export async function registerForPushNotificationsAsync() {
  let token: string | undefined

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted.')
      return null
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId

    try {
      token = (
        await Notifications.getExpoPushTokenAsync({ projectId })
      ).data
    } catch (e) {
      console.log('Error getting push token:', e)
    }
  } else {
    console.log('Must use physical device for Push Notifications.')
  }

  return token ?? null
}
