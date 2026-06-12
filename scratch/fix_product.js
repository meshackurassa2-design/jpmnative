const fs = require('fs');
const path = 'C:/jpm_app/app/product/[id].tsx';
let content = fs.readFileSync(path, 'utf8');

const badContent = `          {/* Dots Indicator */}
          {hasImages && product.image_urls!.length > 1 && (
            <View style={styles.dotsContainer}>
              {product.image_urls!.map((_, idx) => (
              <View style={{ marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>FLASH SALE</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>Ends in 02:45:10</Text>
              </View>
            </View>
          )}`;

const goodContent = `          {/* Dots Indicator */}
          {hasImages && product.image_urls!.length > 1 && (
            <View style={styles.dotsContainer}>
              {product.image_urls!.map((_, idx) => (
                <View 
                  key={idx} 
                  style={[styles.dot, activeImageIndex === idx && styles.activeDot]} 
                />
              ))}
            </View>
          )}

          {/* Close Button overlay */}
          <BackButton style={[styles.closeBtnOverlay, { top: insets.top + 10 }]} />

          {/* Edit Button overlay */}
          {isOwner && (
            <>
              <TouchableOpacity 
                style={[styles.editBtnOverlay, { top: insets.top + 10, right: 60, backgroundColor: '#3b82f6' }]} 
                onPress={handlePromote}
              >
                <Ionicons name="rocket" size={20} color={colors.background} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editBtnOverlay, { top: insets.top + 10 }]} 
                onPress={openEditModal}
              >
                <Ionicons name="pencil" size={20} color={colors.background} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Product Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.price}>{product.price}</Text>
          <Text style={styles.name}>{product.name}</Text>
          
          {(product as any).is_flash_sale && (
            <View style={{ backgroundColor: '#ec4899', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
              <Ionicons name="flash" size={20} color="#fff" />
              <View style={{ marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>FLASH SALE</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>Ends in 02:45:10</Text>
              </View>
            </View>
          )}`;

content = content.replace(badContent, goodContent);
fs.writeFileSync(path, content, 'utf8');
console.log("Fixed!");
