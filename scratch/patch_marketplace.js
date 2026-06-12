const fs = require('fs');

const fixMarketplace = () => {
  const path = 'C:/jpm_app/app/(tabs)/marketplace.tsx';
  let content = fs.readFileSync(path, 'utf8');

  // 1. Sort logic
  const sortTarget = `    return filtered.sort((a: any, b: any) => {
      const ratingA = (a.rating || 0) * 2 + (a.shopRating || 0)
      const ratingB = (b.rating || 0) * 2 + (b.shopRating || 0)`;
  const sortReplace = `    return filtered.sort((a: any, b: any) => {
      if (a.is_promoted && !b.is_promoted) return -1;
      if (!a.is_promoted && b.is_promoted) return 1;
      const ratingA = (a.rating || 0) * 2 + (a.shopRating || 0)
      const ratingB = (b.rating || 0) * 2 + (b.shopRating || 0)`;
  content = content.replace(sortTarget, sortReplace);

  // 2. Render badge
  const badgeTarget = `          {(item as any).rating > 0 && (`;
  const badgeReplace = `          {(item as any).is_promoted && (
            <View style={styles.promotedBadge}>
              <Ionicons name="flash" size={10} color="#fff" />
              <Text style={styles.promotedBadgeText}>PROMOTED</Text>
            </View>
          )}
          {(item as any).rating > 0 && (`
  content = content.replace(badgeTarget, badgeReplace);

  // 3. Styles
  const cardStyleTarget = `productCard: { flex: 1, marginBottom: 20 },`;
  const cardStyleReplace = `productCard: { flex: 1, maxWidth: '48.5%', marginBottom: 20 },`;
  content = content.replace(cardStyleTarget, cardStyleReplace);

  const styleTarget = `  priceText: {`;
  const styleReplace = `  promotedBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#ec4899', paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4
  },
  promotedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  priceText: {`;
  content = content.replace(styleTarget, styleReplace);

  fs.writeFileSync(path, content, 'utf8');
  console.log("Marketplace patched.");
};

const fixShop = () => {
  const path = 'C:/jpm_app/app/shop/[id].tsx';
  let content = fs.readFileSync(path, 'utf8');

  // Fix productCard style
  const cardStyleTarget = `productCard: { flex: 1, marginBottom: 20 },`;
  const cardStyleReplace = `productCard: { flex: 1, maxWidth: '48.5%', marginBottom: 20 },`;
  content = content.replace(cardStyleTarget, cardStyleReplace);

  fs.writeFileSync(path, content, 'utf8');
  console.log("Shop patched.");
};

fixMarketplace();
fixShop();
