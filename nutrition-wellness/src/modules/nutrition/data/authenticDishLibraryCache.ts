import type { AuthenticDishLibraryEntry } from "../types";

// Offline-cached authentic dish library used at runtime. This avoids live scraping per request.
export const CACHED_AUTHENTIC_DISH_LIBRARY: AuthenticDishLibraryEntry[] = [
  {
    canonical_name: "Mango Sticky Rice",
    aliases: ["khao niao mamuang", "mango sticky rice"],
    cuisine: "Thai",
    traditional_summary:
      "A Thai dessert built around sweet sticky rice, ripe mango, and a coconut sauce or coconut cream finish.",
    core_ingredients: ["glutinous rice", "mango", "coconut milk", "salt", "sugar", "sesame or mung bean topping"],
    baseline_steps: [
      "Steam or soak-cook glutinous rice until tender.",
      "Warm coconut milk with salt and sugar, then fold part of it into the rice.",
      "Serve with ripe mango and finish with more coconut sauce and topping.",
    ],
    source_label: "Cached Thai dessert reference",
    source_url: "https://en.wikipedia.org/wiki/Mango_sticky_rice",
  },
  {
    canonical_name: "Tomato Gojju",
    aliases: ["tomato gojju", "gojju", "tomato gojju curry"],
    cuisine: "Indian",
    traditional_summary:
      "A Karnataka-style sweet-sour-spiced tomato preparation that balances tamarind, jaggery, and tempered spices.",
    core_ingredients: ["tomato", "tamarind", "jaggery", "mustard seeds", "dried red chili", "curry leaves", "sesame or coconut"],
    baseline_steps: [
      "Cook tomatoes down until soft and jammy.",
      "Season with tamarind, jaggery, salt, and spice base.",
      "Finish with a tempered tadka and simmer briefly to meld the sweet-sour profile.",
    ],
    source_label: "Cached Karnataka home-style reference",
  },
  {
    canonical_name: "Rajma Chawal",
    aliases: ["rajma rice", "rajma chawal", "rajma"],
    cuisine: "Indian",
    traditional_summary: "Kidney bean curry simmered in a tomato-onion masala and served with steamed rice.",
    core_ingredients: ["kidney beans", "onion", "tomato", "ginger garlic", "spices", "rice"],
    baseline_steps: [
      "Soak and cook kidney beans until tender.",
      "Prepare onion-tomato masala with warming spices.",
      "Simmer beans in masala and serve with rice.",
    ],
    source_label: "Cached Punjabi comfort-food reference",
    source_url: "https://en.wikipedia.org/wiki/Rajma",
  },
  {
    canonical_name: "Baingan Bharta",
    aliases: ["baingan bharta", "eggplant bharta"],
    cuisine: "Indian",
    traditional_summary:
      "A smoky roasted eggplant mash cooked with onion, tomato, chili, and warming spices.",
    core_ingredients: ["eggplant", "onion", "tomato", "garlic", "ginger", "green chili", "spices"],
    baseline_steps: [
      "Roast eggplant until charred and fully soft.",
      "Cook onion, tomato, and aromatics into a masala base.",
      "Fold in mashed eggplant and finish with herbs.",
    ],
    source_label: "Cached North Indian home-style reference",
    source_url: "https://en.wikipedia.org/wiki/Baingan_bharta",
  },
  {
    canonical_name: "Pad Thai",
    aliases: ["pad thai", "phat thai"],
    cuisine: "Thai",
    traditional_summary:
      "A stir-fried noodle dish centered on rice noodles, tamarind, savory sauce, egg, and crunchy toppings.",
    core_ingredients: ["rice noodles", "tamarind", "fish sauce or soy", "garlic", "bean sprouts", "peanuts", "egg"],
    baseline_steps: [
      "Soak rice noodles and mix tamarind-based sauce.",
      "Stir-fry aromatics, add egg or protein, then noodles and sauce.",
      "Finish with sprouts, peanuts, and lime.",
    ],
    source_label: "Cached Thai street-food reference",
    source_url: "https://en.wikipedia.org/wiki/Pad_thai",
  },
  {
    canonical_name: "Piña Colada",
    aliases: ["pina colada", "piña colada"],
    cuisine: "Caribbean",
    traditional_summary:
      "A tropical drink built from pineapple, coconut, and usually rum, blended or shaken until creamy.",
    core_ingredients: ["pineapple juice", "coconut cream", "white rum", "ice"],
    baseline_steps: [
      "Blend or shake pineapple, coconut, and rum with ice until chilled and lightly frothy.",
      "Adjust the sweetness or acidity while keeping the signature pineapple-coconut balance.",
      "Serve cold, with or without garnish, as a tropical beverage.",
    ],
    source_label: "Cached tropical drink reference",
    source_url: "https://en.wikipedia.org/wiki/Pi%C3%B1a_colada",
  },
  {
    canonical_name: "Shakshuka",
    aliases: ["shakshuka", "shakshouka"],
    cuisine: "Middle Eastern",
    traditional_summary:
      "Eggs poached in a spiced tomato and pepper sauce, usually served directly from the pan.",
    core_ingredients: ["eggs", "tomatoes", "bell peppers", "onion", "garlic", "olive oil", "cumin", "paprika"],
    baseline_steps: [
      "Cook onions and peppers until softened.",
      "Add tomatoes and spices to build the sauce.",
      "Poach eggs in the sauce until set.",
    ],
    source_label: "Cached Levant and North African reference",
    source_url: "https://en.wikipedia.org/wiki/Shakshouka",
  },
  {
    canonical_name: "Pozole Rojo",
    aliases: ["pozole rojo", "posole rojo", "red pozole"],
    cuisine: "Mexican",
    traditional_summary:
      "A chile-based hominy stew commonly prepared with pork or chicken and topped with fresh garnishes.",
    core_ingredients: ["hominy", "dried chiles", "onion", "garlic", "broth", "pork or chicken"],
    baseline_steps: [
      "Prepare a red chile base.",
      "Simmer protein and hominy in broth with the chile mixture.",
      "Serve with cabbage, radish, lime, and herbs.",
    ],
    source_label: "Cached Mexican hominy-stew reference",
    source_url: "https://en.wikipedia.org/wiki/Pozole",
  },
  {
    canonical_name: "Miso Salmon Don",
    aliases: ["miso salmon don", "salmon don", "salmon donburi"],
    cuisine: "Japanese",
    traditional_summary:
      "A rice bowl featuring miso-glazed salmon with simple pickled or steamed accompaniments.",
    core_ingredients: ["salmon", "miso", "rice", "soy sauce", "mirin", "ginger"],
    baseline_steps: [
      "Marinate salmon in a miso-based mixture.",
      "Bake or broil until cooked and glazed.",
      "Serve over rice with vegetables or pickles.",
    ],
    source_label: "Cached donburi reference",
  },
  {
    canonical_name: "Chana Masala",
    aliases: ["chana masala", "chole", "chickpea masala"],
    cuisine: "Indian",
    traditional_summary:
      "A chickpea curry built on onion, tomato, ginger, garlic, and spice-forward masala.",
    core_ingredients: ["chickpeas", "onion", "tomato", "ginger", "garlic", "spices"],
    baseline_steps: [
      "Cook or prep chickpeas until tender.",
      "Build an onion-tomato masala with spices.",
      "Simmer chickpeas in masala and finish with herbs.",
    ],
    source_label: "Cached North Indian legume-curry reference",
    source_url: "https://en.wikipedia.org/wiki/Chana_masala",
  },
  {
    canonical_name: "Dal Tadka",
    aliases: ["dal tadka", "tadka dal", "yellow dal tadka"],
    cuisine: "Indian",
    traditional_summary:
      "Cooked lentils finished with a spiced tempering of ghee or oil, aromatics, and dried spices.",
    core_ingredients: ["lentils", "onion", "tomato", "garlic", "ginger", "cumin", "ghee or oil"],
    baseline_steps: [
      "Cook lentils until soft and creamy.",
      "Season the dal base with salt and optional tomato.",
      "Pour over a hot tadka of aromatics and spices before serving.",
    ],
    source_label: "Cached lentil-tadka reference",
  },
  {
    canonical_name: "Bibimbap",
    aliases: ["bibimbap", "bibim bap"],
    cuisine: "Korean",
    traditional_summary:
      "A Korean rice bowl assembled with seasoned vegetables, gochujang, and often egg or beef.",
    core_ingredients: ["rice", "gochujang", "spinach", "bean sprouts", "carrot", "egg or beef", "sesame oil"],
    baseline_steps: [
      "Prepare and season separate vegetable components.",
      "Assemble hot rice with toppings and sauce.",
      "Mix thoroughly before eating.",
    ],
    source_label: "Cached Korean rice-bowl reference",
    source_url: "https://en.wikipedia.org/wiki/Bibimbap",
  },
  {
    canonical_name: "Kimchi Jjigae",
    aliases: ["kimchi jjigae", "kimchi stew"],
    cuisine: "Korean",
    traditional_summary:
      "A warming kimchi stew built from aged kimchi, broth, aromatics, and tofu or pork.",
    core_ingredients: ["kimchi", "broth", "gochugaru", "gochujang", "tofu or pork", "scallions"],
    baseline_steps: [
      "Saute kimchi and aromatics briefly.",
      "Add broth and seasonings, then simmer.",
      "Add tofu or pork and finish with scallions.",
    ],
    source_label: "Cached Korean stew reference",
    source_url: "https://en.wikipedia.org/wiki/Kimchi-jjigae",
  },
  {
    canonical_name: "Pho Bo",
    aliases: ["pho bo", "beef pho", "pho"],
    cuisine: "Vietnamese",
    traditional_summary:
      "A beef noodle soup centered on aromatic broth, rice noodles, herbs, and sliced beef.",
    core_ingredients: ["beef broth", "rice noodles", "beef", "star anise", "ginger", "herbs", "onion"],
    baseline_steps: [
      "Prepare or warm a fragrant beef broth.",
      "Cook rice noodles and prepare thinly sliced beef and garnishes.",
      "Assemble noodles, broth, beef, and herbs just before serving.",
    ],
    source_label: "Cached Vietnamese noodle-soup reference",
    source_url: "https://en.wikipedia.org/wiki/Pho",
  },
  {
    canonical_name: "Avial",
    aliases: ["avial", "aviyal"],
    cuisine: "Indian",
    traditional_summary:
      "A South Indian mixed-vegetable dish finished with coconut, yogurt, curry leaves, and coconut oil.",
    core_ingredients: ["mixed vegetables", "coconut", "yogurt", "green chili", "curry leaves", "coconut oil"],
    baseline_steps: [
      "Cook cut vegetables until just tender.",
      "Fold in ground coconut-chili mixture and yogurt or souring agent.",
      "Finish with curry leaves and coconut oil.",
    ],
    source_label: "Cached Kerala/Tamil mixed-vegetable reference",
  },
  {
    canonical_name: "Aloo Posto",
    aliases: ["aloo posto", "alu posto", "aloo posto curry"],
    cuisine: "Indian",
    traditional_summary:
      "A Bengali potato dish where potatoes are coated in a poppy seed paste, usually lightly spiced with green chili and finished with mustard oil.",
    core_ingredients: ["potato", "white poppy seeds", "green chili", "mustard oil", "nigella seeds", "salt"],
    baseline_steps: [
      "Soak and grind poppy seeds into a coarse paste with green chili.",
      "Temper mustard oil with nigella seeds, then cook the potatoes until just tender.",
      "Fold in the poppy seed paste, simmer briefly, and finish with a little more mustard oil before serving.",
    ],
    source_label: "Cached Bengali home-style reference",
  },
  {
    canonical_name: "Pesarattu",
    aliases: ["pesarattu", "green gram dosa", "pesarattu dosa"],
    cuisine: "Indian",
    traditional_summary:
      "A savory Andhra crepe made from soaked green gram batter and usually served with chutney or upma.",
    core_ingredients: ["green gram", "ginger", "green chili", "cumin", "onion", "oil"],
    baseline_steps: [
      "Soak green gram and grind into a smooth batter with aromatics.",
      "Spread batter on a hot griddle into a thin crepe.",
      "Cook until crisp and serve hot with accompaniments.",
    ],
    source_label: "Cached Andhra breakfast reference",
  },
  {
    canonical_name: "Idli Sambar",
    aliases: ["idli sambar", "idli sambhar", "idli with sambar"],
    cuisine: "Indian",
    traditional_summary:
      "Steamed fermented rice-lentil cakes served with lentil-vegetable sambar and chutney.",
    core_ingredients: ["idli batter", "toor dal", "tamarind", "vegetables", "sambar powder", "mustard seeds"],
    baseline_steps: [
      "Steam fermented idli batter in molds.",
      "Cook a lentil-vegetable sambar with tamarind and spices.",
      "Serve the idlis hot with sambar and chutney.",
    ],
    source_label: "Cached South Indian breakfast reference",
  },
  {
    canonical_name: "Aglio e Olio",
    aliases: ["spaghetti aglio e olio", "aglio e olio"],
    cuisine: "Italian",
    traditional_summary:
      "A simple pasta dish of spaghetti tossed with garlic, olive oil, and chili, sometimes finished with parsley.",
    core_ingredients: ["spaghetti", "garlic", "olive oil", "chili flakes", "parsley"],
    baseline_steps: [
      "Cook pasta until al dente.",
      "Gently infuse olive oil with garlic and chili.",
      "Toss pasta with the infused oil and finish with parsley.",
    ],
    source_label: "Cached Italian pasta reference",
    source_url: "https://en.wikipedia.org/wiki/Spaghetti_aglio_e_olio",
  },
];
