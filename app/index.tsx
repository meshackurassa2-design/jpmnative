import { useTheme } from '../lib/theme';
// app/index.tsx
// Entry point — redirects to tabs if logged in, or auth if not
import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '../lib/auth'

export default function Index() {
  const { colors } = useTheme();
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    )
  }

  return <Redirect href={user ? '/(tabs)' : '/(auth)/welcome-language'} />
}
