/** Country records and a paginated mock API for the async selector demo. */

export interface Country {
  value: string;
  label: string;
  emoji: string;
  aliases: string[];
}

/**
 * Full list of ISO 3166-1 countries with Japanese aliases.
 */
export const ALL_COUNTRIES: Country[] = [
  { value: 'af', label: 'Afghanistan', emoji: '🇦🇫', aliases: ['アフガニスタン'] },
  { value: 'al', label: 'Albania', emoji: '🇦🇱', aliases: ['アルバニア'] },
  { value: 'dz', label: 'Algeria', emoji: '🇩🇿', aliases: ['アルジェリア'] },
  { value: 'ad', label: 'Andorra', emoji: '🇦🇩', aliases: ['アンドラ'] },
  { value: 'ao', label: 'Angola', emoji: '🇦🇴', aliases: ['アンゴラ'] },
  { value: 'ag', label: 'Antigua and Barbuda', emoji: '🇦🇬', aliases: ['アンティグア・バーブーダ'] },
  { value: 'ar', label: 'Argentina', emoji: '🇦🇷', aliases: ['アルゼンチン'] },
  { value: 'am', label: 'Armenia', emoji: '🇦🇲', aliases: ['アルメニア'] },
  { value: 'au', label: 'Australia', emoji: '🇦🇺', aliases: ['オーストラリア', '豪州'] },
  { value: 'at', label: 'Austria', emoji: '🇦🇹', aliases: ['オーストリア'] },
  { value: 'az', label: 'Azerbaijan', emoji: '🇦🇿', aliases: ['アゼルバイジャン'] },
  { value: 'bs', label: 'Bahamas', emoji: '🇧🇸', aliases: ['バハマ'] },
  { value: 'bh', label: 'Bahrain', emoji: '🇧🇭', aliases: ['バーレーン'] },
  { value: 'bd', label: 'Bangladesh', emoji: '🇧🇩', aliases: ['バングラデシュ'] },
  { value: 'bb', label: 'Barbados', emoji: '🇧🇧', aliases: ['バルバドス'] },
  { value: 'by', label: 'Belarus', emoji: '🇧🇾', aliases: ['ベラルーシ'] },
  { value: 'be', label: 'Belgium', emoji: '🇧🇪', aliases: ['ベルギー'] },
  { value: 'bz', label: 'Belize', emoji: '🇧🇿', aliases: ['ベリーズ'] },
  { value: 'bj', label: 'Benin', emoji: '🇧🇯', aliases: ['ベナン'] },
  { value: 'bt', label: 'Bhutan', emoji: '🇧🇹', aliases: ['ブータン'] },
  { value: 'bo', label: 'Bolivia', emoji: '🇧🇴', aliases: ['ボリビア'] },
  {
    value: 'ba',
    label: 'Bosnia and Herzegovina',
    emoji: '🇧🇦',
    aliases: ['ボスニア・ヘルツェゴビナ'],
  },
  { value: 'bw', label: 'Botswana', emoji: '🇧🇼', aliases: ['ボツワナ'] },
  { value: 'br', label: 'Brazil', emoji: '🇧🇷', aliases: ['ブラジル', '伯国'] },
  { value: 'bn', label: 'Brunei', emoji: '🇧🇳', aliases: ['ブルネイ'] },
  { value: 'bg', label: 'Bulgaria', emoji: '🇧🇬', aliases: ['ブルガリア'] },
  { value: 'bf', label: 'Burkina Faso', emoji: '🇧🇫', aliases: ['ブルキナファソ'] },
  { value: 'bi', label: 'Burundi', emoji: '🇧🇮', aliases: ['ブルンジ'] },
  { value: 'cv', label: 'Cabo Verde', emoji: '🇨🇻', aliases: ['カーボベルデ'] },
  { value: 'kh', label: 'Cambodia', emoji: '🇰🇭', aliases: ['カンボジア'] },
  { value: 'cm', label: 'Cameroon', emoji: '🇨🇲', aliases: ['カメルーン'] },
  { value: 'ca', label: 'Canada', emoji: '🇨🇦', aliases: ['カナダ', '加国'] },
  { value: 'cf', label: 'Central African Republic', emoji: '🇨🇫', aliases: ['中央アフリカ共和国'] },
  { value: 'td', label: 'Chad', emoji: '🇹🇩', aliases: ['チャド'] },
  { value: 'cl', label: 'Chile', emoji: '🇨🇱', aliases: ['チリ'] },
  { value: 'cn', label: 'China', emoji: '🇨🇳', aliases: ['中国', '中華人民共和国'] },
  { value: 'co', label: 'Colombia', emoji: '🇨🇴', aliases: ['コロンビア'] },
  { value: 'km', label: 'Comoros', emoji: '🇰🇲', aliases: ['コモロ'] },
  { value: 'cg', label: 'Congo', emoji: '🇨🇬', aliases: ['コンゴ共和国'] },
  { value: 'cd', label: 'Congo (DRC)', emoji: '🇨🇩', aliases: ['コンゴ民主共和国'] },
  { value: 'cr', label: 'Costa Rica', emoji: '🇨🇷', aliases: ['コスタリカ'] },
  { value: 'ci', label: "Côte d'Ivoire", emoji: '🇨🇮', aliases: ['コートジボワール'] },
  { value: 'hr', label: 'Croatia', emoji: '🇭🇷', aliases: ['クロアチア'] },
  { value: 'cu', label: 'Cuba', emoji: '🇨🇺', aliases: ['キューバ'] },
  { value: 'cy', label: 'Cyprus', emoji: '🇨🇾', aliases: ['キプロス'] },
  { value: 'cz', label: 'Czechia', emoji: '🇨🇿', aliases: ['チェコ'] },
  { value: 'dk', label: 'Denmark', emoji: '🇩🇰', aliases: ['デンマーク'] },
  { value: 'dj', label: 'Djibouti', emoji: '🇩🇯', aliases: ['ジブチ'] },
  { value: 'dm', label: 'Dominica', emoji: '🇩🇲', aliases: ['ドミニカ国'] },
  { value: 'do', label: 'Dominican Republic', emoji: '🇩🇴', aliases: ['ドミニカ共和国'] },
  { value: 'ec', label: 'Ecuador', emoji: '🇪🇨', aliases: ['エクアドル'] },
  { value: 'eg', label: 'Egypt', emoji: '🇪🇬', aliases: ['エジプト'] },
  { value: 'sv', label: 'El Salvador', emoji: '🇸🇻', aliases: ['エルサルバドル'] },
  { value: 'gq', label: 'Equatorial Guinea', emoji: '🇬🇶', aliases: ['赤道ギニア'] },
  { value: 'er', label: 'Eritrea', emoji: '🇪🇷', aliases: ['エリトリア'] },
  { value: 'ee', label: 'Estonia', emoji: '🇪🇪', aliases: ['エストニア'] },
  { value: 'sz', label: 'Eswatini', emoji: '🇸🇿', aliases: ['エスワティニ'] },
  { value: 'et', label: 'Ethiopia', emoji: '🇪🇹', aliases: ['エチオピア'] },
  { value: 'fj', label: 'Fiji', emoji: '🇫🇯', aliases: ['フィジー'] },
  { value: 'fi', label: 'Finland', emoji: '🇫🇮', aliases: ['フィンランド'] },
  { value: 'fr', label: 'France', emoji: '🇫🇷', aliases: ['フランス', '仏国'] },
  { value: 'ga', label: 'Gabon', emoji: '🇬🇦', aliases: ['ガボン'] },
  { value: 'gm', label: 'Gambia', emoji: '🇬🇲', aliases: ['ガンビア'] },
  { value: 'ge', label: 'Georgia', emoji: '🇬🇪', aliases: ['ジョージア', 'グルジア'] },
  { value: 'de', label: 'Germany', emoji: '🇩🇪', aliases: ['ドイツ', '独国', 'Deutschland'] },
  { value: 'gh', label: 'Ghana', emoji: '🇬🇭', aliases: ['ガーナ'] },
  { value: 'gr', label: 'Greece', emoji: '🇬🇷', aliases: ['ギリシャ'] },
  { value: 'gd', label: 'Grenada', emoji: '🇬🇩', aliases: ['グレナダ'] },
  { value: 'gt', label: 'Guatemala', emoji: '🇬🇹', aliases: ['グアテマラ'] },
  { value: 'gn', label: 'Guinea', emoji: '🇬🇳', aliases: ['ギニア'] },
  { value: 'gw', label: 'Guinea-Bissau', emoji: '🇬🇼', aliases: ['ギニアビサウ'] },
  { value: 'gy', label: 'Guyana', emoji: '🇬🇾', aliases: ['ガイアナ'] },
  { value: 'ht', label: 'Haiti', emoji: '🇭🇹', aliases: ['ハイチ'] },
  { value: 'hn', label: 'Honduras', emoji: '🇭🇳', aliases: ['ホンジュラス'] },
  { value: 'hu', label: 'Hungary', emoji: '🇭🇺', aliases: ['ハンガリー'] },
  { value: 'is', label: 'Iceland', emoji: '🇮🇸', aliases: ['アイスランド'] },
  { value: 'in', label: 'India', emoji: '🇮🇳', aliases: ['インド', '印度'] },
  { value: 'id', label: 'Indonesia', emoji: '🇮🇩', aliases: ['インドネシア'] },
  { value: 'ir', label: 'Iran', emoji: '🇮🇷', aliases: ['イラン'] },
  { value: 'iq', label: 'Iraq', emoji: '🇮🇶', aliases: ['イラク'] },
  { value: 'ie', label: 'Ireland', emoji: '🇮🇪', aliases: ['アイルランド'] },
  { value: 'il', label: 'Israel', emoji: '🇮🇱', aliases: ['イスラエル'] },
  { value: 'it', label: 'Italy', emoji: '🇮🇹', aliases: ['イタリア', '伊国'] },
  { value: 'jm', label: 'Jamaica', emoji: '🇯🇲', aliases: ['ジャマイカ'] },
  { value: 'jp', label: 'Japan', emoji: '🇯🇵', aliases: ['日本', 'にほん', 'ニホン', 'ニッポン'] },
  { value: 'jo', label: 'Jordan', emoji: '🇯🇴', aliases: ['ヨルダン'] },
  { value: 'kz', label: 'Kazakhstan', emoji: '🇰🇿', aliases: ['カザフスタン'] },
  { value: 'ke', label: 'Kenya', emoji: '🇰🇪', aliases: ['ケニア'] },
  { value: 'ki', label: 'Kiribati', emoji: '🇰🇮', aliases: ['キリバス'] },
  { value: 'kp', label: 'North Korea', emoji: '🇰🇵', aliases: ['北朝鮮', '朝鮮民主主義人民共和国'] },
  { value: 'kr', label: 'South Korea', emoji: '🇰🇷', aliases: ['韓国', '大韓民国'] },
  { value: 'kw', label: 'Kuwait', emoji: '🇰🇼', aliases: ['クウェート'] },
  { value: 'kg', label: 'Kyrgyzstan', emoji: '🇰🇬', aliases: ['キルギス'] },
  { value: 'la', label: 'Laos', emoji: '🇱🇦', aliases: ['ラオス'] },
  { value: 'lv', label: 'Latvia', emoji: '🇱🇻', aliases: ['ラトビア'] },
  { value: 'lb', label: 'Lebanon', emoji: '🇱🇧', aliases: ['レバノン'] },
  { value: 'ls', label: 'Lesotho', emoji: '🇱🇸', aliases: ['レソト'] },
  { value: 'lr', label: 'Liberia', emoji: '🇱🇷', aliases: ['リベリア'] },
  { value: 'ly', label: 'Libya', emoji: '🇱🇾', aliases: ['リビア'] },
  { value: 'li', label: 'Liechtenstein', emoji: '🇱🇮', aliases: ['リヒテンシュタイン'] },
  { value: 'lt', label: 'Lithuania', emoji: '🇱🇹', aliases: ['リトアニア'] },
  { value: 'lu', label: 'Luxembourg', emoji: '🇱🇺', aliases: ['ルクセンブルク'] },
  { value: 'mg', label: 'Madagascar', emoji: '🇲🇬', aliases: ['マダガスカル'] },
  { value: 'mw', label: 'Malawi', emoji: '🇲🇼', aliases: ['マラウイ'] },
  { value: 'my', label: 'Malaysia', emoji: '🇲🇾', aliases: ['マレーシア'] },
  { value: 'mv', label: 'Maldives', emoji: '🇲🇻', aliases: ['モルディブ'] },
  { value: 'ml', label: 'Mali', emoji: '🇲🇱', aliases: ['マリ'] },
  { value: 'mt', label: 'Malta', emoji: '🇲🇹', aliases: ['マルタ'] },
  { value: 'mh', label: 'Marshall Islands', emoji: '🇲🇭', aliases: ['マーシャル諸島'] },
  { value: 'mr', label: 'Mauritania', emoji: '🇲🇷', aliases: ['モーリタニア'] },
  { value: 'mu', label: 'Mauritius', emoji: '🇲🇺', aliases: ['モーリシャス'] },
  { value: 'mx', label: 'Mexico', emoji: '🇲🇽', aliases: ['メキシコ'] },
  { value: 'fm', label: 'Micronesia', emoji: '🇫🇲', aliases: ['ミクロネシア'] },
  { value: 'md', label: 'Moldova', emoji: '🇲🇩', aliases: ['モルドバ'] },
  { value: 'mc', label: 'Monaco', emoji: '🇲🇨', aliases: ['モナコ'] },
  { value: 'mn', label: 'Mongolia', emoji: '🇲🇳', aliases: ['モンゴル'] },
  { value: 'me', label: 'Montenegro', emoji: '🇲🇪', aliases: ['モンテネグロ'] },
  { value: 'ma', label: 'Morocco', emoji: '🇲🇦', aliases: ['モロッコ'] },
  { value: 'mz', label: 'Mozambique', emoji: '🇲🇿', aliases: ['モザンビーク'] },
  { value: 'mm', label: 'Myanmar', emoji: '🇲🇲', aliases: ['ミャンマー', 'ビルマ'] },
  { value: 'na', label: 'Namibia', emoji: '🇳🇦', aliases: ['ナミビア'] },
  { value: 'nr', label: 'Nauru', emoji: '🇳🇷', aliases: ['ナウル'] },
  { value: 'np', label: 'Nepal', emoji: '🇳🇵', aliases: ['ネパール'] },
  { value: 'nl', label: 'Netherlands', emoji: '🇳🇱', aliases: ['オランダ', '蘭国'] },
  { value: 'nz', label: 'New Zealand', emoji: '🇳🇿', aliases: ['ニュージーランド'] },
  { value: 'ni', label: 'Nicaragua', emoji: '🇳🇮', aliases: ['ニカラグア'] },
  { value: 'ne', label: 'Niger', emoji: '🇳🇪', aliases: ['ニジェール'] },
  { value: 'ng', label: 'Nigeria', emoji: '🇳🇬', aliases: ['ナイジェリア'] },
  { value: 'mk', label: 'North Macedonia', emoji: '🇲🇰', aliases: ['北マケドニア'] },
  { value: 'no', label: 'Norway', emoji: '🇳🇴', aliases: ['ノルウェー'] },
  { value: 'om', label: 'Oman', emoji: '🇴🇲', aliases: ['オマーン'] },
  { value: 'pk', label: 'Pakistan', emoji: '🇵🇰', aliases: ['パキスタン'] },
  { value: 'pw', label: 'Palau', emoji: '🇵🇼', aliases: ['パラオ'] },
  { value: 'ps', label: 'Palestine', emoji: '🇵🇸', aliases: ['パレスチナ'] },
  { value: 'pa', label: 'Panama', emoji: '🇵🇦', aliases: ['パナマ'] },
  { value: 'pg', label: 'Papua New Guinea', emoji: '🇵🇬', aliases: ['パプアニューギニア'] },
  { value: 'py', label: 'Paraguay', emoji: '🇵🇾', aliases: ['パラグアイ'] },
  { value: 'pe', label: 'Peru', emoji: '🇵🇪', aliases: ['ペルー'] },
  { value: 'ph', label: 'Philippines', emoji: '🇵🇭', aliases: ['フィリピン', '比国'] },
  { value: 'pl', label: 'Poland', emoji: '🇵🇱', aliases: ['ポーランド'] },
  { value: 'pt', label: 'Portugal', emoji: '🇵🇹', aliases: ['ポルトガル'] },
  { value: 'qa', label: 'Qatar', emoji: '🇶🇦', aliases: ['カタール'] },
  { value: 'ro', label: 'Romania', emoji: '🇷🇴', aliases: ['ルーマニア'] },
  { value: 'ru', label: 'Russia', emoji: '🇷🇺', aliases: ['ロシア', '露国'] },
  { value: 'rw', label: 'Rwanda', emoji: '🇷🇼', aliases: ['ルワンダ'] },
  {
    value: 'kn',
    label: 'Saint Kitts and Nevis',
    emoji: '🇰🇳',
    aliases: ['セントクリストファー・ネイビス'],
  },
  { value: 'lc', label: 'Saint Lucia', emoji: '🇱🇨', aliases: ['セントルシア'] },
  {
    value: 'vc',
    label: 'Saint Vincent and the Grenadines',
    emoji: '🇻🇨',
    aliases: ['セントビンセント・グレナディーン'],
  },
  { value: 'ws', label: 'Samoa', emoji: '🇼🇸', aliases: ['サモア'] },
  { value: 'sm', label: 'San Marino', emoji: '🇸🇲', aliases: ['サンマリノ'] },
  { value: 'st', label: 'São Tomé and Príncipe', emoji: '🇸🇹', aliases: ['サントメ・プリンシペ'] },
  { value: 'sa', label: 'Saudi Arabia', emoji: '🇸🇦', aliases: ['サウジアラビア'] },
  { value: 'sn', label: 'Senegal', emoji: '🇸🇳', aliases: ['セネガル'] },
  { value: 'rs', label: 'Serbia', emoji: '🇷🇸', aliases: ['セルビア'] },
  { value: 'sc', label: 'Seychelles', emoji: '🇸🇨', aliases: ['セーシェル'] },
  { value: 'sl', label: 'Sierra Leone', emoji: '🇸🇱', aliases: ['シエラレオネ'] },
  { value: 'sg', label: 'Singapore', emoji: '🇸🇬', aliases: ['シンガポール'] },
  { value: 'sk', label: 'Slovakia', emoji: '🇸🇰', aliases: ['スロバキア'] },
  { value: 'si', label: 'Slovenia', emoji: '🇸🇮', aliases: ['スロベニア'] },
  { value: 'sb', label: 'Solomon Islands', emoji: '🇸🇧', aliases: ['ソロモン諸島'] },
  { value: 'so', label: 'Somalia', emoji: '🇸🇴', aliases: ['ソマリア'] },
  { value: 'za', label: 'South Africa', emoji: '🇿🇦', aliases: ['南アフリカ'] },
  { value: 'ss', label: 'South Sudan', emoji: '🇸🇸', aliases: ['南スーダン'] },
  { value: 'es', label: 'Spain', emoji: '🇪🇸', aliases: ['スペイン', '西国'] },
  { value: 'lk', label: 'Sri Lanka', emoji: '🇱🇰', aliases: ['スリランカ'] },
  { value: 'sd', label: 'Sudan', emoji: '🇸🇩', aliases: ['スーダン'] },
  { value: 'sr', label: 'Suriname', emoji: '🇸🇷', aliases: ['スリナム'] },
  { value: 'se', label: 'Sweden', emoji: '🇸🇪', aliases: ['スウェーデン'] },
  { value: 'ch', label: 'Switzerland', emoji: '🇨🇭', aliases: ['スイス'] },
  { value: 'sy', label: 'Syria', emoji: '🇸🇾', aliases: ['シリア'] },
  { value: 'tw', label: 'Taiwan', emoji: '🇹🇼', aliases: ['台湾'] },
  { value: 'tj', label: 'Tajikistan', emoji: '🇹🇯', aliases: ['タジキスタン'] },
  { value: 'tz', label: 'Tanzania', emoji: '🇹🇿', aliases: ['タンザニア'] },
  { value: 'th', label: 'Thailand', emoji: '🇹🇭', aliases: ['タイ', '泰国'] },
  { value: 'tl', label: 'Timor-Leste', emoji: '🇹🇱', aliases: ['東ティモール'] },
  { value: 'tg', label: 'Togo', emoji: '🇹🇬', aliases: ['トーゴ'] },
  { value: 'to', label: 'Tonga', emoji: '🇹🇴', aliases: ['トンガ'] },
  { value: 'tt', label: 'Trinidad and Tobago', emoji: '🇹🇹', aliases: ['トリニダード・トバゴ'] },
  { value: 'tn', label: 'Tunisia', emoji: '🇹🇳', aliases: ['チュニジア'] },
  { value: 'tr', label: 'Turkey', emoji: '🇹🇷', aliases: ['トルコ', 'Türkiye'] },
  { value: 'tm', label: 'Turkmenistan', emoji: '🇹🇲', aliases: ['トルクメニスタン'] },
  { value: 'tv', label: 'Tuvalu', emoji: '🇹🇻', aliases: ['ツバル'] },
  { value: 'ug', label: 'Uganda', emoji: '🇺🇬', aliases: ['ウガンダ'] },
  { value: 'ua', label: 'Ukraine', emoji: '🇺🇦', aliases: ['ウクライナ'] },
  { value: 'ae', label: 'United Arab Emirates', emoji: '🇦🇪', aliases: ['アラブ首長国連邦', 'UAE'] },
  {
    value: 'gb',
    label: 'United Kingdom',
    emoji: '🇬🇧',
    aliases: ['イギリス', '英国', 'UK', 'Great Britain'],
  },
  {
    value: 'us',
    label: 'United States',
    emoji: '🇺🇸',
    aliases: ['アメリカ', '米国', 'USA', 'アメリカ合衆国'],
  },
  { value: 'uy', label: 'Uruguay', emoji: '🇺🇾', aliases: ['ウルグアイ'] },
  { value: 'uz', label: 'Uzbekistan', emoji: '🇺🇿', aliases: ['ウズベキスタン'] },
  { value: 'vu', label: 'Vanuatu', emoji: '🇻🇺', aliases: ['バヌアツ'] },
  { value: 'va', label: 'Vatican City', emoji: '🇻🇦', aliases: ['バチカン'] },
  { value: 've', label: 'Venezuela', emoji: '🇻🇪', aliases: ['ベネズエラ'] },
  { value: 'vn', label: 'Vietnam', emoji: '🇻🇳', aliases: ['ベトナム', '越国'] },
  { value: 'ye', label: 'Yemen', emoji: '🇾🇪', aliases: ['イエメン'] },
  { value: 'zm', label: 'Zambia', emoji: '🇿🇲', aliases: ['ザンビア'] },
  { value: 'zw', label: 'Zimbabwe', emoji: '🇿🇼', aliases: ['ジンバブエ'] },
];

/**
 * Check if a country matches the search query.
 */
export function matchesCountry(country: Country, query: string): boolean {
  const q = query.toLowerCase();
  return (
    country.value.includes(q) ||
    country.label.toLowerCase().includes(q) ||
    country.aliases.some((alias) => alias.toLowerCase().includes(q))
  );
}

/**
 * Parameters for fetching countries.
 */
export interface FetchCountriesParams {
  /** Text query for filtering by label/value */
  query?: string;
  /** Filter by exact value matches (for resolving pasted tokens) */
  values?: string[];
  offset: number;
  limit: number;
  excludeValues?: Set<string>;
}

/**
 * Result from fetching countries.
 */
export interface FetchCountriesResult {
  countries: Country[];
  hasMore: boolean;
  total: number;
}

/**
 * Simulate an async API call to fetch countries with pagination.
 * Supports both text search (query) and exact value lookup (values).
 * Includes artificial delay to simulate network latency.
 */
export function fetchCountries(params: FetchCountriesParams): Promise<FetchCountriesResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let filtered: Country[];

      if (params.values && params.values.length > 0) {
        // Exact value lookup mode (for resolving pasted tokens)
        const valueSet = new Set(params.values);
        filtered = ALL_COUNTRIES.filter((c) => valueSet.has(c.value));
      } else {
        // Text search mode (for suggestions)
        const excludeValues = params.excludeValues ?? new Set();
        filtered = ALL_COUNTRIES.filter(
          (c) => !excludeValues.has(c.value) && (!params.query || matchesCountry(c, params.query))
        );
      }

      const paginated = filtered.slice(params.offset, params.offset + params.limit);

      resolve({
        countries: paginated,
        hasMore: params.offset + params.limit < filtered.length,
        total: filtered.length,
      });
    }, 200);
  });
}
