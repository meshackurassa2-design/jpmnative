import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, LayoutAnimation, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import * as Haptics from 'expo-haptics';

const supabase = createClient();
const { width, height } = Dimensions.get('window');

// Magazine Theme Constants
const BG_COLOR = '#F5EFE6'; // Cream Paper
const TEXT_COLOR = '#1A1A1A'; // Charcoal Ink
const ACCENT_COLOR = '#8B0000'; // Deep Red
const SERIF_FONT = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const SANS_FONT = Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';

const GALLERY_ITEMS = [
  {
    id: 'intro',
    type: 'intro',
  },
  {
    id: 'img1',
    type: 'image',
    year: '1995',
    title: 'THE EARLY DAYS',
    image: require('../../assets/images/magufuli_gallery_1.png'),
    caption: 'Before he was the Bulldozer, he was a teacher and a chemist. A man of science who believed that rigorous truth could rebuild a nation from the ground up.'
  },
  {
    id: 'img2',
    type: 'image',
    year: '2000',
    title: 'VOICE OF THE PEOPLE',
    image: require('../../assets/images/magufuli_gallery_2.png'),
    caption: 'He didn\'t speak from palaces; he spoke from the streets. His connection to the common citizen was unbroken, always listening, always pushing for immediate action.'
  },
  {
    id: 'img3',
    type: 'image',
    year: '2010',
    title: 'HUMBLE ROOTS',
    image: require('../../assets/images/magufuli_gallery_3.png'),
    caption: 'Even as his power grew, his lifestyle remained grounded. He rejected the lavish trappings of office, proving that a leader is a servant first.'
  },
  {
    id: 'img4',
    type: 'image',
    year: '2015',
    title: 'THE PILLAR',
    image: require('../../assets/images/magufuli_gallery_4.png'),
    caption: 'Supported by unyielding devotion, he took on the highest office. It was a partnership of immense strength during the nation\'s most turbulent transformations.'
  },
  {
    id: 'img5',
    type: 'image',
    year: '2021',
    title: 'THE COMMANDER',
    image: require('../../assets/images/magufuli_gallery_5.png'),
    caption: 'A legacy etched in stone. He commanded respect not through fear, but through radical self-reliance and the fierce protection of Tanzania\'s wealth.'
  },
  {
    id: 'tribute',
    type: 'tribute',
  }
];

const Particle = ({ particle }: { particle: any }) => {
  const animY = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(Math.random() * 0.5 + 0.5)).current;
  
  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(animY, { 
          toValue: -100 - Math.random() * 150, 
          duration: 1500 + Math.random() * 1000, 
          useNativeDriver: true 
        }),
        Animated.sequence([
          Animated.timing(animOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(animOpacity, { toValue: 0, duration: 1300 + Math.random() * 500, useNativeDriver: true })
        ])
      ]).start();
    }, particle.delay);
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: ACCENT_COLOR,
      left: '50%',
      top: '50%',
      transform: [
        { translateX: particle.x },
        { translateY: animY },
        { scale: animScale }
      ],
      opacity: animOpacity,
    }} />
  )
}

// Interactive Word Animator
const AnimatedWordCaption = ({ text, scrollX, index, style }: { text: string, scrollX: Animated.Value, index: number, style: any }) => {
  const words = text.split(' ');
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {words.map((word, i) => {
        // Guaranteed strictly monotonically increasing input points
        const p1 = (index - 1) * width;
        const p2 = (index - 0.5) * width + (i * (width * 0.4 / words.length));
        const p3 = p2 + (width * 0.05);
        const p4 = (index + 0.5) * width;
        const p5 = (index + 1) * width;

        const wordOpacity = scrollX.interpolate({
          inputRange: [p1, p2, p3, p4, p5],
          outputRange: [0, 0, 1, 1, 0],
          extrapolate: 'clamp'
        });

        const wordTranslateY = scrollX.interpolate({
          inputRange: [p1, p2, p3, p4, p5],
          outputRange: [15, 15, 0, 0, -15],
          extrapolate: 'clamp'
        });

        return (
          <Animated.Text key={i} style={[style, { opacity: wordOpacity, transform: [{ translateY: wordTranslateY }] }]}>
            {word}{' '}
          </Animated.Text>
        )
      })}
    </View>
  )
}

// Continuous Ken Burns Image Component — anchored to TOP so faces are always visible
const KenBurnsImage = ({ source }: { source: any }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 20000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 20000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  // Only pan horizontally & scale gently — NO downward translateY that hides the top
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.06] });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.Image 
        source={source} 
        style={{
          position: 'absolute',
          top: 0,          // Anchored to the TOP — faces always visible
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ scale }, { translateX }]
        }} 
        resizeMode="cover"
      />
    </View>
  );
};

export default function MagufuliLegacyScreen() {
  const { user } = useAuth();
  const scrollX = useRef(new Animated.Value(0)).current;

  // State
  const [respectCount, setRespectCount] = useState(0);
  const [hasPaidRespect, setHasPaidRespect] = useState(false);
  const [tributes, setTributes] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();

    const tributesSub = supabase.channel('tributes_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'magufuli_tributes' }, async (payload) => {
        const { data } = await supabase.from('magufuli_tributes')
          .select('*, profiles(id, full_name, username, avatar_url)')
          .eq('id', payload.new.id).single();
        if (data) setTributes(prev => [data, ...prev]);
      }).subscribe();

    const respectsSub = supabase.channel('respects_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'magufuli_respects' }, payload => {
        if (payload.eventType === 'INSERT') {
          setRespectCount(c => c + 1);
          if (payload.new.user_id === user?.id) setHasPaidRespect(true);
        } else if (payload.eventType === 'DELETE') {
          setRespectCount(c => Math.max(0, c - 1));
          if (payload.old.user_id === user?.id) setHasPaidRespect(false);
        }
      }).subscribe();

    const presenceRoom = supabase.channel('magufuli_room', {
      config: { presence: { key: user?.id || 'anon-' + Math.random() } },
    });

    presenceRoom.on('presence', { event: 'sync' }, () => {
      const newState = presenceRoom.presenceState();
      setOnlineUsers(Math.max(1, Object.keys(newState).length));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await presenceRoom.track({ online_at: new Date().toISOString() });
    });

    return () => {
      supabase.removeChannel(tributesSub);
      supabase.removeChannel(respectsSub);
      supabase.removeChannel(presenceRoom);
    };
  }, [user?.id]);

  const fetchInitialData = async () => {
    try {
      const { count } = await supabase.from('magufuli_respects').select('*', { count: 'exact', head: true });
      if (count !== null) setRespectCount(count);
      if (user) {
        const { data: myRespect } = await supabase.from('magufuli_respects').select('*').eq('user_id', user.id).single();
        if (myRespect) setHasPaidRespect(true);
      }
      const { data: tributesData } = await supabase.from('magufuli_tributes')
        .select('*, profiles(id, full_name, username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(30);
      if (tributesData) setTributes(tributesData);
    } catch (e) { console.log(e); }
  };

  const handlePayRespect = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Spawn interactive particles
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      x: (Math.random() - 0.5) * 120,
      delay: Math.random() * 150,
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(n => n.id === p.id)));
    }, 3000);

    try {
      if (hasPaidRespect) {
        setHasPaidRespect(false);
        setRespectCount(c => Math.max(0, c - 1));
        await supabase.from('magufuli_respects').delete().eq('user_id', user.id);
      } else {
        setHasPaidRespect(true);
        setRespectCount(c => c + 1);
        await supabase.from('magufuli_respects').insert({ user_id: user.id });
      }
    } catch (e) {}
  };

  const postTribute = async () => {
    if (!user || !newMessage.trim()) return;
    const msg = newMessage.trim();
    setNewMessage('');
    
    // Optimistic UI update with LayoutAnimation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const tempTribute = { id: 'temp-' + Date.now(), content: msg, profiles: { full_name: user.user_metadata?.full_name || 'Me' } };
    setTributes(prev => [tempTribute, ...prev]);

    await supabase.from('magufuli_tributes').insert({ user_id: user.id, content: msg });
  };

  const renderItem = ({ item, index }: { item: typeof GALLERY_ITEMS[0], index: number }) => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width
    ];

    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [30, 0, 30],
      extrapolate: 'clamp'
    });

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.95, 1, 0.95],
      extrapolate: 'clamp'
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp'
    });

    if (item.type === 'intro') {
      return (
        <View style={styles.galleryItem}>
          <ScrollView 
            style={{ flex: 1, width: '100%' }}
            contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minHeight: height }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.introBox, { opacity, transform: [{ translateY }] }]}>
              <Text style={styles.introSuper}>SPECIAL EDITION</Text>
              <View style={styles.redLine} />
              <AnimatedWordCaption 
                text="JOHN POMBE MAGUFULI"
                scrollX={scrollX}
                index={index}
                style={styles.introTitle}
              />
              <AnimatedWordCaption 
                text="THE LIFE OF THE BULLDOZER"
                scrollX={scrollX}
                index={index}
                style={styles.introSubtitle}
              />
              <View style={{ marginTop: 24 }}>
                <AnimatedWordCaption 
                  text="A leader who forged a nation with unbreakable will and fierce independence. This is the historic record."
                  scrollX={scrollX}
                  index={index}
                  style={styles.introDesc}
                />
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 60 }}>
                <Text style={{ color: ACCENT_COLOR, fontFamily: SANS_FONT, letterSpacing: 2, fontSize: 10, fontWeight: 'bold' }}>TURN THE PAGE</Text>
                <Ionicons name="arrow-forward" size={16} color={ACCENT_COLOR} style={{ marginLeft: 8 }} />
              </View>
            </Animated.View>
          </ScrollView>
        </View>
      );
    }

    if (item.type === 'image') {
      return (
        <View style={styles.galleryItem}>
          {/* Magazine Background Year watermark */}
          <View style={StyleSheet.absoluteFill}>
            <Text style={styles.backgroundYear}>{item.year}</Text>
          </View>

          <ScrollView 
            style={{ flex: 1, width: '100%' }}
            contentContainerStyle={{ alignItems: 'center', paddingTop: height * 0.15, paddingBottom: height * 0.1 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.articleLayout}>
              {/* The Image is framed like a printed photo */}
              <Animated.View style={[styles.imageWrapper, { opacity, transform: [{ scale }] }]}>
                <KenBurnsImage source={item.image} />
              </Animated.View>
              
              {/* The Article Text */}
              <View style={styles.articleTextContainer}>
                <Animated.View style={{ opacity, transform: [{ translateY }] }}>
                  <Text style={styles.storyYear}>{item.year}</Text>
                  <Text style={styles.storyTitle}>{item.title}</Text>
                  <View style={styles.storyDivider} />
                </Animated.View>

                {/* The alive words */}
                <View style={{ marginTop: 16 }}>
                  <AnimatedWordCaption 
                    text={item.caption}
                    scrollX={scrollX}
                    index={index}
                    style={styles.storyCaption}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (item.type === 'tribute') {
      return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.galleryItem}>
          <Animated.View style={[styles.tributeContainer, { opacity, transform: [{ translateY }] }]}>
            {/* Particles render at the top level of tributeContainer */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {particles.map(p => <Particle key={p.id} particle={p} />)}
            </View>

            <Text style={styles.tributeHeader}>THE GUESTBOOK</Text>
            <Text style={styles.tributeSub}>Citizens' Memorial Wall</Text>
            <View style={styles.redLineCenter} />

            <View style={{ flex: 1, width: '100%', marginTop: 16, marginBottom: 12 }}>
              <FlatList 
                data={tributes}
                keyExtractor={t => t.id}
                inverted
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 40, opacity: 0.4 }}>
                    <Ionicons name="pencil-outline" size={32} color={TEXT_COLOR} />
                    <Text style={{ fontFamily: SERIF_FONT, color: TEXT_COLOR, marginTop: 10, fontStyle: 'italic', textAlign: 'center' }}>{'Be the first to sign\nthe guestbook.'}</Text>
                  </View>
                }
                renderItem={({ item: t }) => (
                  <View style={styles.tributeCard}>
                    <Text style={styles.tributeName}>{t.profiles?.full_name || 'Anonymous'}</Text>
                    <Text style={styles.tributeMessage}>"{t.content}"</Text>
                  </View>
                )}
              />
            </View>

            {/* Flame Button — full interactive zone */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity 
                style={[styles.respectButton, hasPaidRespect && { backgroundColor: ACCENT_COLOR, borderColor: ACCENT_COLOR }]} 
                onPress={handlePayRespect}
                activeOpacity={0.7}
              >
                <Ionicons name={hasPaidRespect ? 'flame' : 'flame-outline'} size={36} color={hasPaidRespect ? '#fff' : ACCENT_COLOR} />
              </TouchableOpacity>
              <Text style={styles.respectCountText}>
                {hasPaidRespect ? '🕯️ ' : ''}{respectCount} {respectCount === 1 ? 'signature' : 'signatures'}
              </Text>
              <Text style={{ fontFamily: SANS_FONT, color: '#888', fontSize: 10, letterSpacing: 1, marginTop: 4 }}>
                {hasPaidRespect ? 'TAP TO REMOVE' : 'TAP TO SIGN'}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput 
                style={styles.input}
                placeholder="Write your tribute..."
                placeholderTextColor="#aaa"
                value={newMessage}
                onChangeText={setNewMessage}
                keyboardAppearance="light"
                returnKeyType="send"
                onSubmitEditing={postTribute}
              />
              <TouchableOpacity onPress={postTribute} style={[styles.postButton, { opacity: newMessage.trim() ? 1 : 0.4 }]} disabled={!newMessage.trim()}>
                <Ionicons name="send" size={16} color={BG_COLOR} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      );
    }
    
    return null;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'MAGUFULI', 
          headerTransparent: false,
          headerStyle: {
            backgroundColor: BG_COLOR,
          },
          headerShadowVisible: false,
          headerTintColor: TEXT_COLOR,
          headerBackTitleVisible: false,
          headerTitleStyle: { 
            fontFamily: SANS_FONT, 
            fontSize: 11, 
            letterSpacing: 5, 
            fontWeight: 'bold',
            color: TEXT_COLOR,
          }
        }} 
      />

      <View style={styles.liveTracker}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>{onlineUsers} READING</Text>
      </View>

      <Animated.FlatList
        data={GALLERY_ITEMS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_COLOR },
  liveTracker: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_COLOR,
    marginRight: 8,
  },
  liveText: {
    color: TEXT_COLOR,
    fontFamily: SANS_FONT,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  galleryItem: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backgroundYear: {
    position: 'absolute',
    top: height * 0.1,
    left: -40,
    fontSize: 240,
    fontFamily: SERIF_FONT,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.03)', // very faint charcoal
    letterSpacing: -15,
  },
  introBox: {
    width: width * 0.85,
    padding: 20,
  },
  introSuper: {
    fontFamily: SANS_FONT,
    color: ACCENT_COLOR,
    letterSpacing: 4,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  redLine: {
    width: 60,
    height: 3,
    backgroundColor: ACCENT_COLOR,
    marginBottom: 24,
  },
  redLineCenter: {
    width: 40,
    height: 2,
    backgroundColor: ACCENT_COLOR,
    marginTop: 16,
  },
  introTitle: {
    fontFamily: SERIF_FONT,
    color: TEXT_COLOR,
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 56,
  },
  introSubtitle: {
    fontFamily: SANS_FONT,
    color: TEXT_COLOR,
    fontSize: 14,
    letterSpacing: 4,
    fontWeight: 'bold',
    marginTop: 16,
  },
  introDesc: {
    fontFamily: SERIF_FONT,
    color: '#444',
    fontSize: 18,
    lineHeight: 28,
    fontStyle: 'italic',
  },
  articleLayout: {
    width: width * 0.85,
    justifyContent: 'flex-start',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 0.85,
    backgroundColor: '#fff',
    borderWidth: 8,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    marginBottom: 30,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  articleTextContainer: {
    paddingHorizontal: 10,
  },
  storyYear: {
    fontFamily: SERIF_FONT,
    color: ACCENT_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  storyTitle: {
    fontFamily: SANS_FONT,
    color: TEXT_COLOR,
    fontSize: 22,
    letterSpacing: 1,
    fontWeight: 'bold',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  storyDivider: {
    width: 30,
    height: 2,
    backgroundColor: TEXT_COLOR,
    marginTop: 12,
  },
  storyCaption: {
    fontFamily: SERIF_FONT,
    color: '#333',
    fontSize: 16,
    lineHeight: 26,
  },
  tributeContainer: {
    width: width * 0.9,
    height: height * 0.8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    padding: 30,
    alignItems: 'center',
  },
  tributeHeader: {
    fontFamily: SERIF_FONT,
    color: TEXT_COLOR,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  tributeSub: {
    fontFamily: SANS_FONT,
    color: '#666',
    fontSize: 10,
    letterSpacing: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  tributeCard: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 16,
  },
  tributeName: {
    fontFamily: SANS_FONT,
    color: ACCENT_COLOR,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tributeMessage: {
    fontFamily: SERIF_FONT,
    color: TEXT_COLOR,
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  respectButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: TEXT_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  respectCountText: {
    color: TEXT_COLOR,
    fontFamily: SANS_FONT,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 2,
    borderBottomColor: TEXT_COLOR,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    fontFamily: SERIF_FONT,
    color: TEXT_COLOR,
    fontSize: 16,
    fontStyle: 'italic',
  },
  postButton: {
    backgroundColor: TEXT_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 12,
    justifyContent: 'center',
  }
});
