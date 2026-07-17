// app/inventory/_layout.tsx
import { Stack } from 'expo-router'

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
