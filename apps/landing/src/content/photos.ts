import type { StaticImageData } from 'next/image';
import friendsPizza from '@/assets/photos/friends-laughing-pizza-restaurant.jpg';
import friendsSelfie from '@/assets/photos/friends-selfie-night-street.jpg';
import coupleBar from '@/assets/photos/couple-laughing-in-bar.jpg';
import coupleDessert from '@/assets/photos/couple-sharing-dessert-restaurant.jpg';
import coupleWalking from '@/assets/photos/couple-walking-talking-city-night.jpg';
import womanNeon from '@/assets/photos/woman-phone-red-neon-night-street.jpg';
import womanNight from '@/assets/photos/woman-checking-phone-night-city.jpg';
import womanRestaurant from '@/assets/photos/woman-with-phone-restaurant-plants.jpg';

/**
 * Licensed stock photography. These are pictures of models, not of VYRA
 * members, and the site says so wherever one appears. Nothing here depicts a
 * real user, a testimonial or a result.
 *
 * Rules for adding one:
 * - `alt` describes what is visible. It does not name or characterise anyone.
 * - `caption` says what the picture illustrates on this site, not what it proves.
 * - `credit` must match the licence record (author and source page). Do not use
 *   an image without one. Credits are rendered on /about#image-credits.
 * - Run `scripts/build-photos.mjs` to produce the file: it caps the size and
 *   strips camera metadata, including any location.
 */
export interface Photo {
  readonly image: StaticImageData;
  /** A short name for lists and credits. */
  readonly title: string;
  readonly alt: string;
  readonly caption: string;
  /** CSS object-position, so a crop keeps what matters. */
  readonly focus: string;
  readonly credit: {
    readonly author: string;
    readonly source: string;
    /** Where the licence was obtained. */
    readonly via: 'Magnific';
  };
}

export const photos = {
  neonStreet: {
    image: womanNeon,
    title: 'Woman with her phone in red neon light',
    alt: 'Smiling young woman in a long cream coat and glasses sitting by a striped shop window on a city street at night, holding up her phone in red neon light.',
    caption: 'Evenings are when most conversations start.',
    focus: '50% 38%',
    credit: {
      author: 'teksomolika',
      source:
        'https://www.magnific.com/free-photo/night-city-beautiful-woman-red-lights_6440799.htm',
      via: 'Magnific',
    },
  },
  nightPhone: {
    image: womanNight,
    title: 'Woman checking her phone on a night street',
    alt: 'Young woman in a dark leather jacket holding her phone at chest height on a night street, her face lit by the screen with city lights blurred behind her.',
    caption: 'A phone, a quiet street, and a message worth answering carefully.',
    focus: '50% 26%',
    credit: {
      author: 'Magnific',
      source:
        'https://www.magnific.com/free-photo/portrait-woman-using-smartphone-night-city-lights_15855621.htm',
      via: 'Magnific',
    },
  },
  dessert: {
    image: coupleDessert,
    title: 'Couple sharing a dessert in a restaurant',
    alt: 'A man and a woman sitting side by side in a restaurant booth, sharing a dessert, with two glasses of orange juice on the table.',
    caption: 'Compatibility is what you notice by the second dessert.',
    focus: '50% 52%',
    credit: {
      author: 'ASphotofamily',
      source:
        'https://www.magnific.com/free-photo/lovely-indian-couple-love-wear-saree-elegant-suit-sitting-restaurant-eating-ice-cream-together_25623432.htm',
      via: 'Magnific',
    },
  },
  restaurantPhone: {
    image: womanRestaurant,
    title: 'Woman looking at her phone in a restaurant',
    alt: 'Young woman in a black embroidered top sitting at a wooden restaurant table among green plants, looking down at the phone in her hand.',
    caption: 'Describing yourself is easier at your own pace.',
    focus: '52% 46%',
    credit: {
      author: 'ASphotofamily',
      source:
        'https://www.magnific.com/free-photo/pretty-indian-girl-black-saree-dress-posed-restaurant-with-mobile-phone-hand_27771103.htm',
      via: 'Magnific',
    },
  },
  pizzaFriends: {
    image: friendsPizza,
    title: 'Friends laughing over pizza',
    alt: 'Friends laughing together at a restaurant table; one of them in a yellow hoodie tips his head back to eat a slice of pizza while another watches.',
    caption: 'Humour is a dimension no photo captures.',
    focus: '52% 42%',
    credit: {
      author: 'ASphotofamily',
      source:
        'https://www.magnific.com/free-photo/asian-friends-guys-eating-pizza-party-pizzeria-happy-indian-people-having-fun-together-eating-italian-food-sitting-couch_25761888.htm',
      via: 'Magnific',
    },
  },
  selfieNight: {
    image: friendsSelfie,
    title: 'Friends taking a selfie at night',
    alt: 'Two friends leaning together on a dark street at night to take a selfie; the man holds the phone toward the camera and both are smiling.',
    caption: 'The point of a good introduction is the evening after it.',
    focus: '50% 42%',
    credit: {
      author: 'Magnific',
      source:
        'https://www.magnific.com/free-photo/front-view-friends-taking-selfie-night_38689346.htm',
      via: 'Magnific',
    },
  },
  walkingCouple: {
    image: coupleWalking,
    title: 'Couple walking and talking in the city at night',
    alt: 'A young woman in a black leather jacket and a bearded man in a maroon blazer walking and talking on a city street at night, with warm street lights blurred behind them.',
    caption: 'Two people, one street, and nothing left to scroll.',
    focus: '50% 46%',
    credit: {
      author: 'Magnific',
      source: 'https://www.magnific.com/free-photo/friends-walking-together-night-out_21077079.htm',
      via: 'Magnific',
    },
  },
  barLaugh: {
    image: coupleBar,
    title: 'Couple laughing together in a bar',
    alt: 'A man in a denim jacket holding a glass of beer and a woman with long wavy hair laughing together on a bar sofa.',
    caption: 'How two people talk is the first thing worth knowing.',
    focus: '50% 40%',
    credit: {
      author: 'Magnific',
      source: 'https://www.magnific.com/free-photo/man-woman-laughing-bar_1300900.htm',
      via: 'Magnific',
    },
  },
} as const satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof photos;

/** Which photograph leads each Learn article. */
export const articlePhoto = {
  'relationship-compatibility': 'dessert',
  'personality-and-relationships': 'neonStreet',
  'communication-styles': 'barLaugh',
  'ai-in-relationship-discovery': 'restaurantPhone',
  'dating-beyond-swiping': 'selfieNight',
  'online-dating-safety': 'nightPhone',
} as const satisfies Record<string, PhotoKey>;

/**
 * Icons are credited alongside the photographs. Each is a line or solid
 * glyph rendered in the surrounding text colour (see src/lib/icon-data.ts).
 */
export const iconCredits = [
  { name: 'Persona', author: 'hari-sabana' },
  { name: 'Compatibility', author: 'Iconir' },
  { name: 'Privacy', author: 'yaicon' },
  { name: 'Chat', author: 'Nur syifa fauziah' },
  { name: 'AI', author: 'Magnific' },
  { name: 'Photo', author: 'afif fudin' },
  { name: 'Location', author: 'prinda895' },
] as const;

/**
 * Which photographs each page shows, for the image sitemap. The SEO audit
 * checks this against the rendered HTML, so a photograph added to a page
 * without being listed here fails the build check.
 */
export const pagePhotos: Readonly<Record<string, readonly PhotoKey[]>> = {
  '/': [
    'neonStreet',
    'pizzaFriends',
    'restaurantPhone',
    'walkingCouple',
    'barLaugh',
    'selfieNight',
    'nightPhone',
    'dessert',
  ],
  '/features': ['walkingCouple', 'pizzaFriends'],
  '/how-it-works': ['nightPhone', 'selfieNight'],
  '/ai-persona': ['restaurantPhone', 'neonStreet'],
  '/compatibility': ['dessert', 'barLaugh'],
  '/safety': ['selfieNight', 'nightPhone'],
  '/learn': ['barLaugh', 'neonStreet'],
  '/learn/relationship-compatibility': ['dessert', 'walkingCouple'],
  '/learn/personality-and-relationships': ['neonStreet', 'restaurantPhone'],
  '/learn/communication-styles': ['barLaugh', 'dessert'],
  '/learn/ai-in-relationship-discovery': ['restaurantPhone', 'neonStreet'],
  '/learn/dating-beyond-swiping': ['selfieNight', 'pizzaFriends'],
  '/learn/online-dating-safety': ['nightPhone', 'selfieNight'],
  '/about': ['pizzaFriends', 'walkingCouple'],
};
