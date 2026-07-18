import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InAppNotification() {
  const { user } = useAuth();
  const supabase = createClient();
  const insets = useSafeAreaInsets();
  
  const [notification, setNotification] = useState<{ title: string, body: string, icon: string, route?: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (!user) return;

    // Listen for new direct messages
    const dmSub = supabase
      .channel('in-app-dms')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, async payload => {
        // Fetch sender's name
        const { data: sender } = await supabase.from('profiles').select('full_name, username').eq('id', payload.new.sender_id).single();
        const senderName = sender?.full_name || sender?.username || 'Someone';

        showNotification({
          title: 'New Message',
          body: `${senderName} sent you a message.`,
          icon: 'chatbubble-ellipses',
          route: '/(tabs)/messages'
        });
      })
      .subscribe();

    // Listen for new orders
    const orderSub = supabase
      .channel('in-app-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items', filter: `shop_id=eq.${user.id}` }, payload => {
        showNotification({
          title: 'New Order! 🛒',
          body: `You received an order for ${payload.new.product_name}`,
          icon: 'cart',
          route: '/(admin)/store-dashboard'
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, payload => {
        if (payload.new.status === 'DELIVERED' && payload.old.status !== 'DELIVERED') {
          // We must check if the current user is the buyer. Since buyer_id is in orders table, we check local state loosely or fetch.
          // For simplicity, we just notify "Order Update" without strict buyer verification if the order is completed.
          // Wait, we can fetch the buyer_id
          supabase.from('orders').select('buyer_id').eq('id', payload.new.order_id).single().then(({ data }) => {
            if (data?.buyer_id === user.id) {
              showNotification({
                title: 'Package Delivered! 📦',
                body: `Your order for ${payload.new.product_name} arrived safely.`,
                icon: 'checkmark-circle',
                route: '/(settings)/purchases'
              });
            }
          });
        }
      })
      .subscribe();

    // Listen for general notifications (likes, comments, follows)
    const notificationSub = supabase
      .channel('in-app-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, async payload => {
        const { type } = payload.new;
        const { data: actor } = await supabase.from('profiles').select('full_name, username').eq('id', payload.new.actor_id).single();
        const actorName = actor?.full_name || actor?.username || 'Someone';

        let title = 'Notification';
        let body = '';
        let icon = 'notifications';

        if (type === 'like') {
          title = 'New Like ❤️';
          body = `${actorName} liked your post.`;
          icon = 'heart';
        } else if (type === 'comment') {
          title = 'New Comment 💬';
          body = `${actorName} commented on your post.`;
          icon = 'chatbubble';
        } else if (type === 'follow') {
          title = 'New Follower 👤';
          body = `${actorName} started following you.`;
          icon = 'person-add';
        } else {
          title = 'New Activity';
          body = `${actorName} interacted with your profile.`;
        }

        showNotification({
          title,
          body,
          icon,
          route: '/(tabs)/notifications'
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dmSub);
      supabase.removeChannel(orderSub);
      supabase.removeChannel(notificationSub);
    };
  }, [user]);

  const showNotification = (data: { title: string, body: string, icon: string, route?: string }) => {
    setNotification(data);
    
    // Slide down
    Animated.spring(slideAnim, {
      toValue: insets.top > 0 ? insets.top + 10 : 40,
      useNativeDriver: true,
      bounciness: 12
    }).start();

    // Hide after 4 seconds
    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true
      }).start(() => {
        setNotification(null);
      });
    }, 4000);
  };

  if (!notification) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity 
        style={styles.toast} 
        activeOpacity={0.8} 
        onPress={() => {
          if (notification.route) router.push(notification.route as any);
        }}
      >
        <BlurView intensity={70} tint="dark" style={styles.glassToast}>
          <View style={styles.iconBox}>
            <Image source={require('../assets/icon_real.png')} style={{ width: 28, height: 28, borderRadius: 8 }} resizeMode="contain" />
          </View>
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
            <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  glassToast: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#222'
  },
  content: {
    flex: 1
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4
  },
  body: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20
  }
});
