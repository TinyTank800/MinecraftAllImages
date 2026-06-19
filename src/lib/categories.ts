/** Heuristic category assignment from item filename (mirrors enrich-metadata.mjs logic). */
export type ItemCategory =
	| 'blocks'
	| 'combat'
	| 'tools'
	| 'food'
	| 'redstone'
	| 'spawn_eggs'
	| 'decorations'
	| 'materials'
	| 'misc';

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
	blocks: 'Building Blocks',
	combat: 'Combat',
	tools: 'Tools',
	food: 'Food & Drinks',
	redstone: 'Redstone',
	spawn_eggs: 'Spawn Eggs',
	decorations: 'Decorations',
	materials: 'Materials',
	misc: 'Miscellaneous',
};

export const ALL_CATEGORIES: ItemCategory[] = [
	'blocks',
	'combat',
	'tools',
	'food',
	'redstone',
	'spawn_eggs',
	'decorations',
	'materials',
	'misc',
];

export function categorizeItem(filename: string): ItemCategory {
	const base = filename.replace(/\.png$/i, '').toLowerCase();
	if (base.endsWith('_spawn_egg')) return 'spawn_eggs';
	if (/_sword|_axe|_bow|crossbow|_shield|_helmet|_chestplate|_leggings|_boots|_trident|_mace/.test(base)) return 'combat';
	if (/_pickaxe|_shovel|_hoe|fishing_rod|shears|flint_and_steel|_brush/.test(base)) return 'tools';
	if (/apple|bread|beef|pork|chicken|fish|salmon|cookie|cake|pie|stew|soup|honey|melon|carrot|potato|beetroot|berries|mutton|rabbit|chorus|golden_|cooked_|raw_|sweet_|glow_|spider_eye|poisonous|pufferfish|tropical|kelp|dried/.test(base)) return 'food';
	if (/redstone|repeater|comparator|piston|observer|lever|button|pressure_plate|tripwire|detector_rail|activator_rail|daylight|target|hopper|dropper|dispenser|note_block|sculk_sensor/.test(base)) return 'redstone';
	if (/ingot|nugget|gem|shard|dust|pearl|rod|coal|charcoal|brick|clay_ball|slime_ball|ender_|blaze_|ghast_|nether_star|heart_of_the_sea|scute|prismarine|copper|amethyst|quartz|lapis|diamond|emerald|iron|gold|netherite/.test(base)) return 'materials';
	if (/banner|bed|carpet|painting|flower|sapling|sign|pot|torch|lantern|candle|banner|skull|head|music_disc|book|map|firework|dye|glass|wool|terracotta|concrete|glazed|leaves|log|planks|stairs|slab|fence|door|trapdoor|wall|boat|chest_boat|hanging_sign/.test(base)) return 'decorations';
	if (/stone|ore|deepslate|dirt|sand|gravel|obsidian|netherrack|basalt|blackstone|tuff|calcite|amethyst|copper|deepslate|mud|sculk|ice|snow|grass_block|mycelium|podzol|rooted|moss|dripstone|prismarine|sandstone|granite|diorite|andesite|brick|terracotta|concrete|wool|block|planks|log|leaves|stem|hyphae|nylium|fungus|roots|vine|kelp|coral|sponge|honeycomb|beehive|respawn_anchor|lodestone|ancient_debris|crying_obsidian|gilded|shroomlight|soul_|warped_|crimson_|bamboo|cherry|mangrove|pale_oak/.test(base)) return 'blocks';
	return 'misc';
}
