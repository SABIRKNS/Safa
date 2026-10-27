// Course catalogue for Grade 6. To add a subject (English, Hindi, Sanskrit...),
// copy one block below, give it a new unique `id`, and list its chapters.
// Chapter numbers are simply the position in the list (1, 2, 3...).

export const COURSES = [
  {
    id: "maths",
    short: "Maths",
    title: "Mathematics",
    book: "Ganita Prakash",
    emoji: "📐",
    color: "#3F6FB0",
    unitLabel: "Chapter",
    practice: true, // has interactive practice in /resources/maths-hub.html
    bookUrl: "https://ncert.nic.in/textbook.php?fegp1=0-10",
    chapters: [
      "Patterns in Mathematics",
      "Lines and Angles",
      "Number Play",
      "Data Handling and Presentation",
      "Prime Time",
      "Perimeter and Area",
      "Fractions",
      "Playing with Constructions",
      "Symmetry",
      "The Other Side of Zero"
    ]
  },
  {
    id: "science",
    short: "Science",
    title: "Science",
    book: "Curiosity",
    emoji: "🔬",
    color: "#167A67",
    unitLabel: "Chapter",
    bookUrl: "https://ncert.nic.in/textbook.php?fecu1=0-12",
    chapters: [
      "The Wonderful World of Science",
      "Diversity in the Living World",
      "Mindful Eating: A Path to a Healthy Body",
      "Exploring Magnets",
      "Measurement of Length and Motion",
      "Materials Around Us",
      "Temperature and its Measurement",
      "A Journey through States of Water",
      "Methods of Separation in Everyday Life",
      "Living Creatures: Exploring their Characteristics",
      "Nature's Treasures",
      "Beyond Earth"
    ]
  },
  {
    id: "social",
    short: "Social Sci.",
    title: "Social Science",
    book: "Exploring Society: India and Beyond",
    emoji: "🌏",
    color: "#C23B56",
    unitLabel: "Chapter",
    bookUrl: "https://ncert.nic.in/textbook.php?fees1=0-14",
    chapters: [
      "Locating Places on the Earth",
      "Oceans and Continents",
      "Landforms and Life",
      "Timeline and Sources of History",
      "India, That Is Bharat",
      "The Beginnings of Indian Civilisation",
      "India's Cultural Roots",
      "Unity in Diversity, or 'Many in the One'",
      "Family and Community",
      "Grassroots Democracy – Part 1: Governance",
      "Grassroots Democracy – Part 2: Local Government in Rural Areas",
      "Grassroots Democracy – Part 3: Local Government in Urban Areas",
      "The Value of Work",
      "Economic Activities Around Us"
    ]
  },
  {
    id: "pe",
    short: "PE",
    title: "Physical Education and Well-being",
    book: "Khel Yatra",
    emoji: "🏃",
    color: "#D9A22B",
    unitLabel: "Unit",
    bookUrl: "https://ncert.nic.in/textbook.php",
    chapters: [
      "Importance of Physical Education and Well-being",
      "Motor Fitness",
      "Fundamental Skills of Kho-Kho",
      "Fundamental Skills of Handball",
      "Yoga"
    ]
  },
  {
    id: "kaushal",
    short: "Vocational",
    title: "Vocational Education",
    book: "Kaushal Bodh",
    emoji: "🛠️",
    color: "#6C4AB6",
    unitLabel: "Project",
    bookUrl: "https://ncert.nic.in/textbook.php",
    chapters: [
      "School Kitchen Garden",
      "Biodiversity Register",
      "Maker Skills",
      "Animation and Games",
      "School Museum",
      "Cooking without Fire"
    ]
  }
];

export const COURSE_MAP = Object.fromEntries(COURSES.map((c) => [c.id, c]));
