const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'jpm_app', 'app', '(tabs)', 'index.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const originalJsx = `    return (
      <View style={styles.post}>
        <TouchableOpacity
          style={styles.postHeader}
          onPress={() => router.push(\`/user-profile?id=\${post.creator_id}\`)}
          activeOpacity={0.7}
        >
          {post.profiles?.avatar_url ? (
            <Image source={{ uri: getCdnUrl(post.profiles.avatar_url) }} style={[styles.avatar, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]}>
              <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.postHeaderText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.fullName}>{post.profiles?.full_name}</Text>
              {post.profiles?.is_verified && (
                <Ionicons name="checkmark-circle" size={14} color="#2563eb" />
              )}
              {post.profiles?.settings?.account_type === 'news' && (
                <Ionicons name="newspaper" size={14} color="#eab308" />
              )}
            </View>
            <Text style={styles.username}>
              @{post.profiles?.username} · {timeAgo(post.created_at)}
              {post.is_ghost && <Text style={{ color: '#f59e0b' }}>  👻 24h</Text>}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {post.profiles?.settings?.shop_category === 'Food & Restaurants' && (
              <TouchableOpacity style={{ padding: 4, marginRight: 4 }} onPress={confirmHideAllSpecialPosts}>
                <Ionicons name="close" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ padding: 4 }} onPress={() => handlePostOptions(post)}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.9}>
          {!!post.content && (
            <Text style={styles.postContent}>{post.content}</Text>
          )}
        </TouchableOpacity>

        {post.settings?.is_betting_code && post.settings?.betting_code && (
          <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 16 }}>
            <View style={{ backgroundColor: '#111118', borderRadius: 16, borderWidth: 1, borderColor: '#05966955', padding: 16, shadowColor: '#10b981', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: {width:0, height:4} }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="football" size={14} color="#10b981" />
                    <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>{post.settings.betting_platform || 'Betting'} CODE</Text>
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 2, marginTop: 6 }}>{post.settings.betting_code}</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={{ backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}
                onPress={() => {
                  Clipboard.setStringAsync(post.settings.betting_code)
                  showToast('Code copied to clipboard!', 'success')
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="copy" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>COPY CODE</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 8, justifyContent: 'center' }}>
              <Ionicons name="warning" size={12} color="#f59e0b" />
              <Text style={{ fontSize: 11, color: '#a1a1aa', fontWeight: '500' }}>Warning: Betting involves risk. Copy and play at your own risk.</Text>
            </View>
          </View>
        )}

        {post.video_url && (
          <View style={{ marginBottom: 10 }}>
            <Video
              source={{ uri: getCdnUrl(post.video_url) }}
              style={styles.postImage}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              isLooping
              shouldPlay={isFocused && visibleItems.has(post.id)}
            />
          </View>
        )}

        {hasImage && (
          <View>
            {post.image_urls!.length > 1 ? (
              <ScrollView 
                horizontal 
                pagingEnabled 
                snapToInterval={feedWidth}
                snapToAlignment="center"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false} 
                style={{ marginBottom: 10 }}
              >
                {post.image_urls!.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.95} style={{ width: feedWidth }}>
                    <Image
                      source={{ uri: getCdnUrl(url) }}
                      style={[styles.postImage, { marginBottom: 0 }]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.95}>
                <Image
                  source={{ uri: getCdnUrl(post.image_urls![0]) }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)} activeOpacity={0.7}>
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={22}
              color={post.is_liked ? '#ef4444' : '#71717a'}
            />
            {(post.likes_count || 0) > 0 && (
              <Text style={[styles.actionCount, post.is_liked && { color: '#ef4444' }]}>
                {post.likes_count}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={22} color="#71717a" />
            {(post.comments_count || 0) > 0 && (
              <Text style={styles.actionCount}>{post.comments_count}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => toggleRepost(post)}>
            <Ionicons
              name={post.is_reposted ? 'sync' : 'sync-outline'}
              size={22}
              color={post.is_reposted ? '#16a34a' : '#71717a'}
            />
            {(post.reposts_count || 0) > 0 && (
              <Text style={[styles.actionCount, post.is_reposted && { color: '#16a34a' }]}>
                {post.reposts_count}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleBookmark(post)} activeOpacity={0.7}>
            <Ionicons
              name={post.is_bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={post.is_bookmarked ? '#2563eb' : '#71717a'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />
      </View>
    )`;

const newJsx = `    return (
      <View style={styles.post}>
        {/* Left Column: Avatar */}
        <View style={styles.postLeftColumn}>
          <TouchableOpacity onPress={() => router.push(\`/user-profile?id=\${post.creator_id}\`)} activeOpacity={0.7}>
            {post.profiles?.avatar_url ? (
              <Image source={{ uri: getCdnUrl(post.profiles.avatar_url) }} style={[styles.avatar, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, post.is_ghost && { borderWidth: 2, borderColor: '#f59e0b' }]}>
                <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Right Column: Content */}
        <View style={styles.postRightColumn}>
          {/* Header Row */}
          <View style={styles.postHeaderRow}>
            <TouchableOpacity onPress={() => router.push(\`/user-profile?id=\${post.creator_id}\`)} activeOpacity={0.7} style={styles.postUserInfo}>
              <Text style={styles.fullName} numberOfLines={1}>{post.profiles?.full_name}</Text>
              {post.profiles?.is_verified && <Ionicons name="checkmark-circle" size={14} color="#2563eb" />}
              {post.profiles?.settings?.account_type === 'news' && <Ionicons name="newspaper" size={14} color="#eab308" />}
              <Text style={styles.username} numberOfLines={1}>@{post.profiles?.username} · {timeAgo(post.created_at)}</Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {post.profiles?.settings?.shop_category === 'Food & Restaurants' && (
                <TouchableOpacity style={{ padding: 4, marginRight: 4 }} onPress={confirmHideAllSpecialPosts}>
                  <Ionicons name="close" size={18} color="#a1a1aa" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ padding: 4 }} onPress={() => handlePostOptions(post)}>
                <Ionicons name="ellipsis-horizontal" size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
          </View>

          {post.is_ghost && <Text style={{ color: '#f59e0b', fontSize: 13, marginBottom: 4, fontWeight: '600' }}>👻 Ghost Post · 24h</Text>}

          {/* Text Content */}
          <TouchableOpacity onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.9}>
            {!!post.content && (
              <Text style={styles.postContent}>{post.content}</Text>
            )}
          </TouchableOpacity>

          {/* Betting Code */}
          {post.settings?.is_betting_code && post.settings?.betting_code && (
            <View style={{ marginTop: 8, marginBottom: 12 }}>
              <View style={{ backgroundColor: '#111118', borderRadius: 16, borderWidth: 1, borderColor: '#05966955', padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="football" size={14} color="#10b981" />
                      <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>{post.settings.betting_platform || 'Betting'} CODE</Text>
                    </View>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 2, marginTop: 6 }}>{post.settings.betting_code}</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={{ backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}
                  onPress={() => {
                    Clipboard.setStringAsync(post.settings.betting_code)
                    showToast('Code copied to clipboard!', 'success')
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>COPY CODE</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Media */}
          {post.video_url && (
            <View style={styles.mediaContainer}>
              <Video
                source={{ uri: getCdnUrl(post.video_url) }}
                style={styles.postImage}
                resizeMode={ResizeMode.COVER}
                useNativeControls
                isLooping
                shouldPlay={isFocused && visibleItems.has(post.id)}
              />
            </View>
          )}

          {hasImage && (
            <View style={styles.mediaContainer}>
              {post.image_urls!.length > 1 ? (
                <ScrollView 
                  horizontal 
                  pagingEnabled 
                  snapToInterval={feedWidth - 70} // account for left column
                  snapToAlignment="center"
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                >
                  {post.image_urls!.map((url, idx) => (
                    <TouchableOpacity key={idx} onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.95} style={{ width: feedWidth - 70, paddingRight: 8 }}>
                      <Image
                        source={{ uri: getCdnUrl(url) }}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <TouchableOpacity onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.95}>
                  <Image
                    source={{ uri: getCdnUrl(post.image_urls![0]) }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post)} activeOpacity={0.7}>
              <Ionicons
                name={post.is_liked ? 'heart' : 'heart-outline'}
                size={18}
                color={post.is_liked ? '#ef4444' : '#71717a'}
              />
              {(post.likes_count || 0) > 0 && (
                <Text style={[styles.actionCount, post.is_liked && { color: '#ef4444' }]}>
                  {post.likes_count}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(\`/post/\${post.id}\`)} activeOpacity={0.7}>
              <Ionicons name="chatbubble-outline" size={18} color="#71717a" />
              {(post.comments_count || 0) > 0 && (
                <Text style={styles.actionCount}>{post.comments_count}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => toggleRepost(post)}>
              <Ionicons
                name={post.is_reposted ? 'sync' : 'sync-outline'}
                size={18}
                color={post.is_reposted ? '#16a34a' : '#71717a'}
              />
              {(post.reposts_count || 0) > 0 && (
                <Text style={[styles.actionCount, post.is_reposted && { color: '#16a34a' }]}>
                  {post.reposts_count}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleBookmark(post)} activeOpacity={0.7}>
              <Ionicons
                name={post.is_bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={post.is_bookmarked ? '#2563eb' : '#71717a'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />
      </View>
    )`;

const oldStyles = `  // ── Post ──
  post: { paddingTop: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 16 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: '#e4e4e7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.textDim },
  postHeaderText: { flex: 1 },
  fullName: { fontSize: 15, fontWeight: '700', color: colors.text },
  username: { fontSize: 13, color: colors.textDim, marginTop: 1 },
  postContent: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: 10, paddingHorizontal: 16 },
  postImage: { width: '100%', height: width * 1.1, marginBottom: 10, backgroundColor: colors.border },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, paddingHorizontal: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },`;

const newStyles = `  // ── Post ──
  post: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingTop: 12,
    position: 'relative'
  },
  postLeftColumn: {
    width: 44,
    marginRight: 10,
    alignItems: 'center',
  },
  postRightColumn: {
    flex: 1,
    paddingBottom: 4,
  },
  postHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 4 
  },
  postUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.textDim },
  fullName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  username: { fontSize: 14, color: colors.textDim, flexShrink: 1 },
  postContent: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: 10 },
  mediaContainer: {
    width: '100%',
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  postImage: { 
    width: '100%', 
    aspectRatio: 1, // Keep it square or let it adjust, we use aspectRatio 1 for standard X style
    backgroundColor: colors.border 
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingBottom: 8,
    paddingRight: 20
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 13, color: colors.textDim, fontWeight: '500' },
  divider: { 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth, 
    backgroundColor: colors.border 
  },`;

if (!content.includes(originalJsx.trim().substring(0, 50))) {
  console.log("Original JSX not found!");
} else {
  content = content.replace(originalJsx, newJsx);
  content = content.replace(oldStyles, newStyles);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully replaced layout and styles!");
}
