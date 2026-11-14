import type { Business, TestCase } from "./types";

/**
 * Larkspur Night Line is an invented sleeper-train company. Its help centre
 * is the demo knowledge base: specific enough (prices, deadlines, exceptions)
 * that a wrong answer is easy to spot.
 */
export const DEMO_BUSINESS: Business = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "larkspur",
  name: "Larkspur Night Line",
  assistantName: "Wren",
  greeting:
    "Evening. I'm Wren, Larkspur's assistant. Ask me about cabins, luggage, pets, refunds or delays and I'll point you to the page I got it from.",
  tone: "warm",
  dailyLimit: 400,
  isDemo: true,
  suggestions: [
    "Can I bring my dog?",
    "What happens if my train is late?",
    "How late can I board?",
    "Is breakfast included?",
  ],
};

export const DEMO_DOCUMENTS: { title: string; content: string }[] = [
  {
    title: "Tickets and fares",
    content: `# Tickets and fares

## Fare types
We sell three fares on every departure.

Saver is our lowest fare. It cannot be refunded, but it can be moved to another date for a €25 change fee up to 48 hours before departure.

Flex can be changed free of charge and refunded in full up to 24 hours before departure. Inside 24 hours a Flex ticket is refunded at 50%.

Open is fully refundable until the train departs and can be used on any departure within 30 days of the date printed on it.

## Children and young travellers
Children under 4 travel free when they share a berth with an adult, so a baby or a 3 year old needs no ticket. Children aged 4 to 13 pay half the adult fare. Travellers aged 14 to 25 get 20% off Flex and Open fares with a Larkspur Youth card.

## When booking opens
Tickets go on sale 120 days before departure. Summer departures (June to August) and the last two weeks of December usually sell out of private cabins about six weeks ahead.

## Paying
We accept Visa, Mastercard, American Express, Apple Pay and Google Pay. We do not accept cash on board for tickets. Prices are in euros and include all taxes.

## Group bookings
Groups of 10 or more should book through the groups desk at groups@larkspur.example. Group fares need a 20% deposit and the balance is due 30 days before departure.`,
  },
  {
    title: "Cabins and seats",
    content: `# Cabins and seats

## Reclining seat
The lowest-priced way to travel. A wide seat that reclines to 40 degrees, with a reading light, a power socket and a blanket. Seats are in an open carriage of 36. Showers are not included.

## Couchette
A berth in a shared compartment of four, with a pillow, sheet and blanket. Compartments are mixed by default. You can ask for a women-only compartment when you book, at no extra cost. Couchette passengers share the washrooms at the end of the carriage.

## Sleeper cabin
A private, lockable cabin for one or two people with made-up beds, a washbasin, towels and a wake-up call. Breakfast is included and is served in your cabin. Sleeper passengers can use the showers at the end of the carriage.

## Grand sleeper
Our largest cabin, for one or two people, with a private shower and toilet, a double bed on request, and access to the departure lounge from two hours before boarding. Dinner and breakfast are included.

## Accessible cabin
Every train has one accessible sleeper cabin in carriage 4, next to an accessible toilet, with level boarding by ramp. It sleeps one wheelchair user and one companion and is sold at the couchette price. Book it by phone or chat at least 48 hours ahead so we can arrange the ramp.

## Power and wifi
Every seat and berth has a power socket and a USB-C port. Wifi is free in all classes, but it drops out in the Calder Pass tunnels for about 25 minutes.`,
  },
  {
    title: "Luggage, bikes and pets",
    content: `# Luggage, bikes and pets

## Luggage allowance
Each passenger can bring two bags of up to 23 kg each, plus one small item such as a handbag or laptop bag. There is no check-in: you carry your bags on yourself. Bags go under the lower berth or on the rack above the door. Anything longer than 180 cm cannot be carried.

## Bikes
Each train has 12 bike spaces in carriage 9. A bike reservation costs €12 and must be booked in advance, because spaces sell out in summer. Folding bikes in a bag travel free as ordinary luggage. E-bikes are welcome, but the battery must stay on the bike. Cargo bikes and tandems do not fit the racks and cannot be carried.

## Dogs and cats
Dogs and cats are welcome in sleeper cabins and grand sleepers when you book the whole cabin. A pet ticket costs €30 per animal, with a limit of two animals per cabin. Pets cannot travel in reclining seats or couchettes, because those spaces are shared.

Dogs must be on a lead in corridors and are not allowed in the dining car. The train stops for 15 minutes at Morrow Junction at about 23:40, which is the only chance for a walk before morning.

## Assistance animals
Guide dogs and other trained assistance animals travel free in every class, including the dining car, and do not need a pet ticket.

## Smoking and vaping
Smoking and vaping are not allowed anywhere on the train, including cabins and the spaces between carriages. The 15-minute stop at Morrow Junction is the only smoking break.

## Things you cannot bring
Gas canisters, fireworks, and e-scooters with batteries above 300 Wh are not allowed on board.`,
  },
  {
    title: "Refunds, changes and cancellations",
    content: `# Refunds, changes and cancellations

## Changing your ticket
You can change the date or time of a Flex or Open ticket free of charge in your booking, up to 24 hours before departure. Saver tickets can be changed for a €25 fee up to 48 hours before departure. If the new fare is higher, you pay the difference. If it is lower, we do not refund the difference on Saver tickets.

## Cancelling
Flex tickets are refunded in full up to 24 hours before departure and at 50% after that. Open tickets are refunded in full until departure. Saver tickets are not refundable, but you can change the name on a Saver ticket for €10 so that someone else can travel.

## If you miss the train
A missed train is treated as a cancellation after departure. Saver and Flex tickets have no value once the train has left. Open tickets stay valid for another departure within 30 days.

## How refunds are paid
Refunds go back to the card you paid with. They take 5 to 7 working days to show on your statement. We cannot refund to a different card or to a bank account.

## If we cancel
If Larkspur cancels your train, you can choose a full refund or a free move to any departure in the next 14 days, whatever fare you bought. We will also cover a hotel up to €120 per room if the cancellation leaves you stranded overnight.`,
  },
  {
    title: "Delays and compensation",
    content: `# Delays and compensation

## What you are owed
If you arrive late at your final Larkspur station, we pay back part of your fare:

- 60 to 119 minutes late (one to two hours): 25% of the fare for that journey
- 120 minutes or more (two hours): 50% of the fare for that journey
- 240 minutes or more (four hours): 100% of the fare for that journey

Delay is measured at your final station, not at departure. Compensation is paid on the ticket fare only, not on extras such as bike reservations or pet tickets.

## How to claim
Claim within 60 days of travel at larkspur.example/claims with your booking reference. We pay within 14 days, to your original card or as a travel voucher worth 10% more if you prefer.

## Missed connections
If a Larkspur delay makes you miss a connecting train booked on the same ticket, we will put you on the next available service at no cost. Connections bought separately are not covered, so leave at least 90 minutes when you book them yourself.

## Delays outside our control
Compensation is still paid when the delay is caused by weather or by problems on the track. It is not paid if the delay was caused by a passenger pulling the emergency brake without reason.

## During a long delay
If the train is held for more than 90 minutes, the crew hands out water and a snack to everyone on board, free of charge.`,
  },
  {
    title: "Boarding and stations",
    content: `# Boarding and stations

## When to arrive
Boarding opens 45 minutes before departure and closes 5 minutes before. Doors lock at closing time and the crew cannot reopen them, so aim to be on the platform 20 minutes ahead.

## What to bring
Bring your ticket (on your phone or printed) and photo ID that matches the name on the ticket. The crew checks both at the carriage door. Children under 14 do not need ID when they travel with an adult.

## Finding your carriage
Your carriage and berth numbers are on your ticket. Carriage numbers are shown on the platform screens 30 minutes before departure. Sleeper cabins are in carriages 1 to 4, couchettes in 5 to 7, reclining seats in 8, and the bike carriage is 9.

## Our route
The Night Line runs every night in both directions between Port Aveline and Sorrel Heights, calling at Hartwell, Morrow Junction and Calder Pass. The northbound train leaves Port Aveline at 20:15 and reaches Sorrel Heights at 07:40. The southbound train leaves Sorrel Heights at 20:50 and reaches Port Aveline at 08:05.

## Departure lounge
The lounge at Port Aveline and Sorrel Heights is open to Grand sleeper passengers from two hours before boarding. Other passengers can buy lounge access for €18, subject to space.

## Left luggage
Port Aveline and Sorrel Heights have staffed left-luggage desks, open 07:00 to 22:00. It costs €6 per bag per day.`,
  },
  {
    title: "Food and drink on board",
    content: `# Food and drink on board

## Dining car
The dining car is in the middle of the train and is open to everyone. Dinner is served from departure until 22:30. The bar stays open until midnight. Breakfast is served from 06:00 until 30 minutes before arrival.

## What is included
Breakfast is included with Sleeper cabin and Grand sleeper tickets and is brought to your cabin at the time you choose. Grand sleeper tickets also include a three-course dinner in the dining car. Couchette and reclining seat passengers can buy breakfast for €9.

## Dietary needs
Vegetarian and vegan dishes are always on the menu. Gluten-free, halal and kosher meals must be ordered at least 72 hours before departure, in your booking or by chat. Our kitchen handles nuts, so we cannot promise a nut-free meal.

## Bringing your own
You are welcome to bring your own food and soft drinks on board. Alcohol you bring yourself, such as wine or beer, may be drunk in private cabins only, not in seats, couchettes or the dining car.

## Water
Drinking water taps are at the end of every carriage. Sleeper passengers get a bottle of water in the cabin.`,
  },
  {
    title: "Contact and lost property",
    content: `# Contact and lost property

## Talking to a person
Our support team answers chat and email every day from 07:00 to 23:00. Email help@larkspur.example. We reply to email within one working day. For anything on the day of travel, call us. Our phone number is 0800 555 0142 and the line is open 06:00 to midnight.

## On board
The train manager is in carriage 5 through the night. You can also press the call button in any cabin or by any carriage door.

## Lost property
Things found on board are kept at the station where the train ended its journey for 30 days. Report a lost item at larkspur.example/lost with your booking reference and a description. We can post it to you for a flat €15 within the country. Passports and ID cards are handed to the station police the next morning.

## Complaints
Write to care@larkspur.example. We answer complaints within 10 working days. If you are not satisfied with our answer, you can take it to the independent Rail Passenger Ombudsman.`,
  },
];

type DemoTest = Omit<TestCase, "id" | "businessId">;

export const DEMO_TEST_CASES: DemoTest[] = [
  {
    question: "Can I bring my dog on the train?",
    expected:
      "Yes, in a sleeper cabin or grand sleeper if you book the whole cabin. A pet ticket is €30 per animal, up to two per cabin. Not in seats or couchettes.",
    keyFacts: ["€30|30 euro", "sleeper", "whole cabin|entire cabin"],
    shouldAnswer: true,
  },
  {
    question: "How much compensation do I get if we arrive two and a half hours late?",
    expected: "50% of the fare for that journey, because the delay is 120 minutes or more.",
    keyFacts: ["50%"],
    shouldAnswer: true,
  },
  {
    question: "What time does boarding close?",
    expected: "5 minutes before departure. Boarding opens 45 minutes before.",
    keyFacts: ["5 minutes"],
    shouldAnswer: true,
  },
  {
    question: "Can I get a refund on a Saver ticket?",
    expected:
      "No. Saver tickets are not refundable, but you can move the date for €25 up to 48 hours before departure, or change the name for €10.",
    keyFacts: ["not refundable|cannot be refunded|non-refundable|can't be refunded", "€25|25 euro"],
    shouldAnswer: true,
  },
  {
    question: "Is breakfast included with a couchette?",
    expected: "No. Couchette passengers can buy breakfast for €9.",
    keyFacts: ["€9|9 euro"],
    shouldAnswer: true,
  },
  {
    question: "How many bags can I take?",
    expected: "Two bags of up to 23 kg each, plus one small item.",
    keyFacts: ["two bags|2 bags", "23 kg|23kg"],
    shouldAnswer: true,
  },
  {
    question: "How long does a refund take?",
    expected: "5 to 7 working days, back to the card you paid with.",
    keyFacts: ["5 to 7|5-7|5–7", "working days|business days"],
    shouldAnswer: true,
  },
  {
    question: "Do you take bikes, and what does it cost?",
    expected: "Yes. A bike reservation is €12 and must be booked in advance. Folding bikes in a bag are free.",
    keyFacts: ["€12|12 euro"],
    shouldAnswer: true,
  },
  {
    question: "I need a gluten-free dinner. What should I do?",
    expected: "Order it at least 72 hours before departure, in your booking or by chat.",
    keyFacts: ["72 hours"],
    shouldAnswer: true,
  },
  {
    question: "When does the northbound train leave Port Aveline?",
    expected: "20:15, arriving at Sorrel Heights at 07:40.",
    keyFacts: ["20:15"],
    shouldAnswer: true,
  },
  {
    question: "Do you have a loyalty programme or points scheme?",
    expected: "The documents do not mention one, so the assistant should decline.",
    keyFacts: [],
    shouldAnswer: false,
  },
  {
    question: "Can I pay for my ticket with Bitcoin?",
    expected: "The documents list card and wallet payments only and say nothing about crypto. Decline.",
    keyFacts: [],
    shouldAnswer: false,
  },
  {
    question: "What's the weather like in Sorrel Heights in March?",
    expected: "Not a support question the documents cover. Decline.",
    keyFacts: [],
    shouldAnswer: false,
  },
  {
    question: "Is there a smoking carriage?",
    expected: "No. Smoking and vaping are not allowed anywhere on the train. The stop at Morrow Junction is the only break.",
    keyFacts: ["not allowed|no smoking|isn't allowed|cannot smoke|can't smoke"],
    shouldAnswer: true,
  },
  {
    question: "Do you sell gift cards?",
    expected: "The documents do not mention gift cards. Decline.",
    keyFacts: [],
    shouldAnswer: false,
  },
];

/** Conversations the demo starts with, so the owner area is not empty. */
export const DEMO_SEED_QUESTIONS: { questions: string[]; minutesAgo: number; feedback?: (1 | -1)[] }[] = [
  { questions: ["Can I bring my dog?", "Is she allowed in the dining car?"], minutesAgo: 14, feedback: [1] },
  { questions: ["What happens if my train is late by 2 hours?"], minutesAgo: 52, feedback: [1] },
  { questions: ["Do you have a loyalty programme?"], minutesAgo: 95 },
  { questions: ["How late can I board?", "What ID do I need?"], minutesAgo: 180, feedback: [1, 1] },
  { questions: ["Can I cancel a Saver ticket?"], minutesAgo: 260, feedback: [-1] },
  { questions: ["Do you sell gift cards?"], minutesAgo: 420 },
  { questions: ["Are bikes allowed and how much is it?"], minutesAgo: 610, feedback: [1] },
  { questions: ["I'm coeliac, can I get a gluten-free breakfast?"], minutesAgo: 1300 },
  { questions: ["How many bags can I bring?"], minutesAgo: 1500, feedback: [1] },
];

export const DEMO_FOLLOW_UPS = [
  { email: "m•••@example.com", question: "Do you have a loyalty programme?", minutesAgo: 94 },
  { email: "j•••@example.com", question: "Do you sell gift cards?", minutesAgo: 418 },
];
