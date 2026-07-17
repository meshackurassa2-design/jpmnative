import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform, TouchableWithoutFeedback } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from './theme'

const { height, width } = Dimensions.get('window')

export type ActionSheetOption = {
  text: string
  style?: 'default' | 'destructive' | 'cancel'
  icon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
}

type UIContextType = {
  showActionSheet: (title: string, options: ActionSheetOption[]) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  isTabBarVisible: boolean
  setTabBarVisible: (visible: boolean) => void
}

const UIContext = createContext<UIContextType>({
  showActionSheet: () => {},
  showToast: () => {},
  isTabBarVisible: true,
  setTabBarVisible: () => {},
})

export function UIProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const styles = React.useMemo(() => getStyles(colors), [colors])

  // -- TOAST STATE --
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')
  const toastAnim = useRef(new Animated.Value(150)).current

  // -- TAB BAR STATE --
  const [isTabBarVisible, setTabBarVisible] = useState(true)

  // -- ACTION SHEET STATE --
  const [sheetTitle, setSheetTitle] = useState('')
  const [sheetOptions, setSheetOptions] = useState<ActionSheetOption[]>([])
  const [sheetVisible, setSheetVisible] = useState(false)
  const sheetAnim = useRef(new Animated.Value(height)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  // -- TOAST LOGIC --
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message)
    setToastType(type)
    Animated.spring(toastAnim, {
      toValue: -(insets.bottom + 90),
      useNativeDriver: true,
      bounciness: 12,
      speed: 14
    }).start()

    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 150,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToastMessage(''))
    }, 3000)
  }

  // -- ACTION SHEET LOGIC --
  const showActionSheet = (title: string, options: ActionSheetOption[]) => {
    setSheetTitle(title)
    setSheetOptions(options)
    setSheetVisible(true)
    
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 14 })
    ]).start()
  }

  const hideActionSheet = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: height, duration: 250, useNativeDriver: true })
    ]).start(() => setSheetVisible(false))
  }

  const getToastIcon = () => {
    if (toastType === 'success') return 'checkmark-circle'
    if (toastType === 'error') return 'alert-circle'
    return 'information-circle'
  }
  const getToastColor = () => {
    if (toastType === 'success') return '#10b981'
    if (toastType === 'error') return '#ef4444'
    return '#3b82f6'
  }

  return (
    <UIContext.Provider value={{ showActionSheet, showToast, isTabBarVisible, setTabBarVisible }}>
      {children}

      {/* --- TOAST --- */}
      {!!toastMessage && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
          <Ionicons name={getToastIcon() as any} size={20} color={getToastColor()} style={styles.toastIcon} />
          <Text style={styles.toastText} numberOfLines={2}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* --- ACTION SHEET --- */}
      {sheetVisible && (
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback onPress={hideActionSheet}>
            <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetAnim }], paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.handle} />
            {!!sheetTitle && <Text style={styles.sheetTitle}>{sheetTitle}</Text>}
            <View style={styles.optionsList}>
              {sheetOptions.map((opt, i) => {
                const isCancel = opt.style === 'cancel'
                const isDestructive = opt.style === 'destructive'
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.optionBtn, isCancel && styles.optionCancel]}
                    activeOpacity={0.7}
                    onPress={() => {
                      hideActionSheet()
                      setTimeout(() => opt.onPress(), 300) // Execute after animation
                    }}
                  >
                    {opt.icon && <Ionicons name={opt.icon} size={20} color={isDestructive ? '#ef4444' : colors.text} style={{ marginRight: 12 }} />}
                    <Text style={[styles.optionText, isDestructive && styles.optionTextDestructive, isCancel && styles.optionTextCancel]}>
                      {opt.text}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Animated.View>
        </View>
      )}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)

const getStyles = (colors: any) => StyleSheet.create({
  // Toast
  toastContainer: {
    position: 'absolute', bottom: 0, alignSelf: 'center',
    backgroundColor: '#18181b', // sleek dark pill
    borderRadius: 30, // fully rounded
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 10,
    zIndex: 9999,
  },
  toastIcon: { marginRight: 10 },
  toastText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 14, fontWeight: '600', color: colors.textDim,
    textAlign: 'center', marginBottom: 16,
  },
  optionsList: {
    backgroundColor: 'transparent',
    borderRadius: 16, overflow: 'hidden',
    marginBottom: 8,
  },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background
  },
  optionCancel: {
    marginTop: 8, borderRadius: 16, borderBottomWidth: 0,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  optionText: { fontSize: 16, fontWeight: '600', color: colors.text },
  optionTextDestructive: { color: '#ef4444' },
  optionTextCancel: { color: colors.text, fontWeight: '700' },
})
