import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { getCdnUrl } from '../lib/cdn';

export default function BestFriendsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const supabase = createClient();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [bestFriends, setBestFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (user) fetchBestFriends();
  }, [user]);

  const fetchBestFriends = async () => {
    if (!user) return;
    setLoading(true);
    const { data: bfData, error } = await supabase
      .from('best_friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && bfData && bfData.length > 0) {
      const friendIds = bfData.map((d: any) => d.friend_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, is_verified')
        .in('id', friendIds);
      
      if (profiles) {
        // Sort profiles to match the order of bfData (which is sorted by created_at)
        const sortedProfiles = friendIds.map(id => profiles.find(p => p.id === id)).filter(Boolean);
        setBestFriends(sortedProfiles);
      }
    } else {
      setBestFriends([]);
    }
    setLoading(false);
  };

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, is_verified')
      .neq('id', user?.id)
      .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(10);

    if (!error && data) {
      setSearchResults(data);
    }
    setSearching(false);
  };

  const addBestFriend = async (profile: any) => {
    if (!user) return;
    if (bestFriends.length >= 5) {
      Alert.alert('Limit Reached', 'You can only have a maximum of 5 best friends for exclusive stories.');
      return;
    }
    if (bestFriends.some(f => f.id === profile.id)) {
      Alert.alert('Already Added', 'This person is already in your Top 5.');
      return;
    }

    const newBestFriends = [...bestFriends, profile];
    setBestFriends(newBestFriends);

    const { error } = await supabase
      .from('best_friends')
      .insert({ user_id: user.id, friend_id: profile.id });

    if (error) {
      Alert.alert('Error', error.message);
      setBestFriends(bestFriends); // Revert
    }
  };

  const removeBestFriend = async (friendId: string) => {
    if (!user) return;
    
    Alert.alert('Remove Friend', 'Are you sure you want to remove them from your Top 5?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const prev = [...bestFriends];
        setBestFriends(prev.filter(f => f.id !== friendId));
        
        const { error } = await supabase
          .from('best_friends')
          .delete()
          .eq('user_id', user.id)
          .eq('friend_id', friendId);

        if (error) {
          Alert.alert('Error', 'Failed to remove best friend.');
          setBestFriends(prev); // Revert
        }
      }}
    ]);
  };

  const renderItem = ({ item }: { item: any }) => {
    const isFriend = bestFriends.some(f => f.id === item.id);
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        {item.avatar_url ? (
          <Image source={{ uri: getCdnUrl(item.avatar_url) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.border }]}>
            <Text style={{ color: colors.textDim, fontWeight: 'bold' }}>{item.full_name?.[0] || '?'}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.name, { color: colors.text }]}>{item.full_name}</Text>
            {item.is_verified && <Ionicons name="checkmark-circle" size={14} color="#2563eb" />}
          </View>
          <Text style={{ color: colors.textDim, fontSize: 13 }}>@{item.username}</Text>
        </View>
        
        {isFriend ? (
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: colors.border }]} 
            onPress={() => removeBestFriend(item.id)}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>Remove</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: bestFriends.length >= 5 ? colors.border : colors.primary }]} 
            onPress={() => addBestFriend(item)}
            disabled={bestFriends.length >= 5}
          >
            <Text style={{ color: bestFriends.length >= 5 ? colors.textDim : '#fff', fontWeight: '700' }}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Top 5 Best Friends</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
            Choose your Top 5 ({bestFriends.length}/5)
          </Text>
          <Text style={{ fontSize: 14, color: colors.textDim, lineHeight: 20 }}>
            Stories are now exclusive to your Top 5 Best Friends. Add people here to see their stories. They won't see yours unless they add you back!
          </Text>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textDim} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search for people..."
            placeholderTextColor={colors.textDim}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
        </View>

        {query.length > 0 ? (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginVertical: 12 }}>Search Results</Text>
            {searching ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 20 }}>No users found.</Text>}
              />
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginVertical: 12 }}>Your Top 5</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={bestFriends}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', marginTop: 40, padding: 20, backgroundColor: colors.border, borderRadius: 16 }}>
                    <Ionicons name="people-outline" size={48} color={colors.textDim} style={{ marginBottom: 12 }} />
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 6 }}>No friends added yet</Text>
                    <Text style={{ color: colors.textDim, textAlign: 'center' }}>Search above to add people to your Top 5 to unlock their stories.</Text>
                  </View>
                }
              />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '800' },
  content: { flex: 1, padding: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  }
});
