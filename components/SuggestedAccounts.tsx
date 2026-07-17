import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Dimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { getCdnUrl } from '../lib/cdn';
import { VibeBadge } from './VibeBadge';
import { useTranslation } from '../lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function SuggestedAccounts() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const supabase = createClient();
  const { t } = useTranslation();
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkDismissalStatus();
  }, []);

  const checkDismissalStatus = async () => {
    try {
      const hideUntil = await AsyncStorage.getItem('@hide_suggestions_until');
      if (hideUntil && parseInt(hideUntil, 10) > Date.now()) {
        setDismissed(true);
        setLoading(false);
      } else {
        if (user) fetchSuggestions();
      }
    } catch (e) {
      if (user) fetchSuggestions();
    }
  };

  const handleDismiss = async () => {
    setDismissed(true);
    // Hide for 24 hours
    const hideTime = Date.now() + 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem('@hide_suggestions_until', hideTime.toString());
  };

  const fetchSuggestions = async () => {
    if (!user) return;
    
    // Get users I already follow
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);
      
    const followedIds = (follows || []).map(f => f.following_id);
    followedIds.push(user.id); // Also exclude self

    // Query profiles. We want to prioritize dapaz, then verified, then others.
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_verified, settings')
      .limit(30);

    if (error) {
      console.error('Error fetching suggestions:', error);
      return;
    }

    if (profiles) {
      // Filter out people we already follow
      let potential = profiles.filter(p => !followedIds.includes(p.id));

      // Shuffle the array randomly so "others" change from time to time
      potential.sort(() => Math.random() - 0.5);

      // Sort: dapaz first, then verified, then others
      potential.sort((a, b) => {
        if (a.username?.toLowerCase() === 'dapaz') return -1;
        if (b.username?.toLowerCase() === 'dapaz') return 1;
        if (a.is_verified && !b.is_verified) return -1;
        if (!a.is_verified && b.is_verified) return 1;
        return 0; // Keep random order for the rest
      });

      // Take top 8
      setSuggestions(potential.slice(0, 8));
    }
    setLoading(false);
  };

  const handleFollow = async (profileId: string) => {
    if (!user) return;
    
    // Optimistically remove from suggestions
    setSuggestions(prev => prev.filter(p => p.id !== profileId));
    
    await supabase.from('follows').insert({
      follower_id: user.id,
      following_id: profileId
    });
  };

  if (loading || dismissed || suggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('people_you_may_know')}</Text>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color={colors.textDim} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={suggestions}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.9}
            onPress={() => router.push(`/user-profile?id=${item.id}`)}
          >
            <View style={styles.avatarContainer}>
              {item.avatar_url ? (
                <Image source={{ uri: getCdnUrl(item.avatar_url) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                  <Text style={[styles.avatarText, { color: colors.textDim }]}>{item.full_name?.[0] || '?'}</Text>
                </View>
              )}
              {item.settings?.vibe && (
                <VibeBadge vibe={item.settings.vibe} size={14} style={styles.vibeBadge} />
              )}
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.full_name}
                </Text>
                {item.is_verified && <Ionicons name="checkmark-circle" size={12} color="#2563eb" />}
              </View>
              <Text style={[styles.username, { color: colors.textDim }]} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.followBtn, { backgroundColor: colors.text }]}
              onPress={() => handleFollow(item.id)}
            >
              <Text style={[styles.followText, { color: colors.background }]}>{t('follow')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: 140,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  vibeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  info: {
    alignItems: 'center',
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  username: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  followBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  followText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
