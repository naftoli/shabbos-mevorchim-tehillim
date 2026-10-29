export const COUNSELOR = "I'm not sure about that one. Please ask your counselor or a grown-up."

export const TOPICS = [
  {
    "id": "greetings",
    "title": "Greetings and small talk",
    "items": [
      {
        "q": "Hi! / Hello / Shalom",
        "a": "Hi {name}! How can I help you today?",
        "data": "`name`",
        "f": [
          {
            "q": "How are you?",
            "a": "I'm great, and I'm ready to help with your Tehillim! What would you like to know?"
          },
          {
            "q": "What's my name?",
            "a": "You're {name}, a soldier in Hashem's army!"
          }
        ]
      },
      {
        "q": "Who are you?",
        "also": "What's your name? / What are you?",
        "a": "I'm your virtual commander! I'm here to help with your Tehillim, your ladder, your missions and medals, and to cheer you on. What can I help with?",
        "f": [
          {
            "q": "Are you a real person? / Are you a robot?",
            "a": "I'm your virtual commander, a helper on the Tehillim Club site. I'm here for your Tehillim anytime."
          },
          {
            "q": "Who made you?",
            "a": "Tzivos Hashem made me!"
          }
        ]
      },
      {
        "q": "What can you do? / What can I ask you?",
        "a": "Ask me anything about your Tehillim, {name}! Like what to say this month, how you're doing, your medals, your ladder, your rank, when the next Shabbos Mevorchim is, or how it all works.",
        "f": [
          {
            "q": "Can you change my ladder?",
            "a": "Yes! Just tell me which ladder, like “change me to ladder 8,” and I'll check it with you first.",
            "action": "changeLadder (see Changing my ladder)"
          },
          {
            "q": "Can you put in my Tehillim for me?",
            "a": "I can direct you how to do it! On your page, type how many kapitlach you said in the “Kapitlach I said” box and your minutes in the “Minutes I said” box, then tap Save. That's it!"
          }
        ]
      },
      {
        "q": "Thank you!",
        "a": "Anytime, {name}!",
        "f": []
      },
      {
        "q": "Bye / Good Shabbos / Gotta go",
        "a": "Gut Shabbos, {name}! Don't forget your Tehillim.",
        "f": []
      },
      {
        "q": "I'm so happy! / This is awesome!",
        "a": "That makes me happy too, {name}! Let's keep it going. Say your Tehillim and climb higher!",
        "f": []
      },
      {
        "q": "I'm sad / scared / upset",
        "a": "I'm sorry you're feeling that way, {name}. Saying a little Tehillim can comfort the heart. And if something's really bothering you, please talk to a parent, teacher, or Rabbi. I'm here for your Tehillim whenever you're ready.",
        "f": []
      },
      {
        "q": "Can you help with my homework? / Tell me a joke / Let's play a game",
        "a": "I'm just here to help with your Tehillim, {name}! Want to hear what you say this month?",
        "note": "The AI rules say to stay only on Tehillim Club topics and steer back.",
        "f": [
          {
            "q": "Please? Just one?",
            "a": "I'd love to help, but I'm only for Tehillim. Want to know how many missions you have?"
          }
        ]
      }
    ]
  },
  {
    "id": "club",
    "title": "The club and the goal",
    "items": [
      {
        "q": "What is the Tehillim Club?",
        "a": "The Worldwide Tehillim Club is a Tzivos Hashem mivtza. Kids like you, soldiers in Hashem's army, say Tehillim every Shabbos Mevorchim and climb grade by grade toward the whole Sefer Tehillim. You're part of a worldwide army!",
        "f": [
          {
            "q": "Why am I called a soldier?",
            "a": "Because you're in Tzivos Hashem, Hashem's army! Your class is your platoon, your school is your base, and all the kids together are the army."
          },
          {
            "q": "How many kids are in it?",
            "a": "Soldiers all over the world are in the club! The Home page shows every school and the worldwide Tehillim count climbing together."
          }
        ]
      },
      {
        "q": "What's the goal?",
        "a": "The goal is to say the whole Sefer Tehillim every Shabbos Mevorchim! Your ladder is the training that builds you up to it, one month at a time.",
        "f": [
          {
            "q": "How long does it take?",
            "a": "It depends on your ladder. Ladder {ladder} finishes your training by {finishTrainingByGrade} grade."
          },
          {
            "q": "Why do I need to train?",
            "a": "Saying all 150 kapitlach is a lot! Your ladder starts you with a smaller amount and adds a little more each month, so you can do it."
          }
        ]
      },
      {
        "q": "What is Tehillim?",
        "also": "What's a kapitel? / How many kapitlach are there?",
        "a": "Tehillim has 150 kapitlach, written by Dovid HaMelech. Saying them is a beautiful way to daven to Hashem, and in our club you climb toward saying all 150!",
        "f": []
      },
      {
        "q": "Why do we say Tehillim on Shabbos Mevorchim?",
        "a": "The Hayom Yom on Chof Hei Shvat says we should be careful to say the whole Tehillim on Shabbos Mevorchim. That's our mission every month!",
        "f": [
          {
            "q": "Who started this?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up. (Shimmy mentioned the Frierdiker Rebbe and the Rebbe for the Resources page, but the wording for kids isn't written yet.)",
            "shimmy": true
          }
        ]
      },
      {
        "q": "Why does my Tehillim matter?",
        "also": "Does it count? / Who does it help?",
        "a": "Every kapitel you say counts for your class, your school, and the whole Tzivos Hashem army, {name}. You lift everyone up! And when every child in your class finishes, you become a Perfect Platoon.",
        "f": [
          {
            "q": "How does it add up?",
            "a": "Your quota adds up to your class quota. Every class adds up to your school's quota, and every school adds up to the whole army's quota. Your whole class, your school, and the whole army are relying on you!"
          }
        ]
      }
    ]
  },
  {
    "id": "ladders",
    "title": "Ladders: what they are",
    "items": [
      {
        "q": "What is a ladder?",
        "a": "A ladder is your training plan. Its number is the grade you'll finish your training by and be able to say the whole Tehillim. Ladder 5 finishes by 5th grade, and ladder 12 finishes by 12th grade.",
        "f": [
          {
            "q": "Why is a lower number harder?",
            "a": "A lower ladder finishes your training sooner, so you say a little more each month. A higher number is a gentler climb."
          },
          {
            "q": "Which ladder is the easiest?",
            "a": "Ladder 12 is the easiest, but your training will take until 12th grade."
          },
          {
            "q": "Which ladder is the hardest?",
            "a": "For you, ladder {hardest} is the hardest. You'd finish your training and be able to say the entire Tehillim by the end of {hardest} grade."
          }
        ]
      },
      {
        "q": "Which ladders can I pick?",
        "a": "In {childGradeLabel} grade you can choose ladder {list}.",
        "data": "`ladderChoices` (rule: ladders from the bigger of 5 or your grade, up to 12)",
        "note": "Live server today only has ladders 5 to 10 set up. 11 and 12 come later, and the server says “That ladder isn't available for you yet.”",
        "f": [
          {
            "q": "Why can't I pick ladder 4?",
            "a": "Ladder 5 is the most challenging ladder there is. In {childGradeLabel} grade you can choose ladder {list}."
          },
          {
            "q": "Why can't I pick a ladder lower than my grade?",
            "a": "Ladder {n} isn't one you can pick in {childGradeLabel} grade. A ladder has to finish in your grade or later. You can choose ladder {list}."
          }
        ]
      },
      {
        "q": "Which ladder should I pick?",
        "also": "Help me pick",
        "a": "Let's start by choosing the ladder that works best for you. You can take ladder {easiest}. That's the easiest ladder, but your training will take until {easiest} grade. Or ladder {hardest}, the hardest, and you'll finish by {hardest} grade. There are other ladders in between. Want to see what ladder {easiest} means for you?",
        "data": "`ladderChoices`, `childGradeLabel`, `monthEn`",
        "f": [
          {
            "q": "You pick for me",
            "a": "It's your choice, {name}! Pick whatever feels right. You can always change it later. Want to start with ladder {easiest}?"
          },
          {
            "q": "What would my friends pick?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      },
      {
        "q": "What does ladder 8 mean for me?",
        "also": "Tell me about ladder {n}",
        "a": "Let's take a look at ladder {n}. Now we're holding Shabbos Mevorchim {monthEn}, and you're in {childGradeLabel} grade. If you take ladder {n}, your quota is {kapitlach} kapitlach and {minutes} minutes. Does that work for you, or would you like to check out a more challenging ladder?",
        "data": "`ladderChoices[n].kapitlach`, `ladderChoices[n].minutes`",
        "f": [
          {
            "q": "That's good for me",
            "a": "Okay, that's fine. That's a great place to start, and I wish you a lot of hatzlacha! Don't forget to come back after Shabbos Mevorchim and put in the kapitlach and the minutes you said. {name}, your whole class, your platoon, is relying on you, your school, your base, is relying on you, and the whole army is relying on you. So give it all you got!",
            "action": "changeLadder(n)"
          },
          {
            "q": "A more challenging ladder",
            "a": "Moves to the next lower number and gives that ladder's quota the same way."
          },
          {
            "q": "An easier ladder",
            "a": "Moves to the next higher number and gives that ladder's quota the same way."
          }
        ]
      },
      {
        "q": "Do I stay on the same ladder next year?",
        "a": "Yes! You stay on the same ladder number every year, and each year it gives you a bit more, until you finish your training.",
        "f": [
          {
            "q": "What happens when I finish my ladder?",
            "a": "In {finishTrainingByGrade} grade your quota becomes the whole Tehillim, all 150 kapitlach, every Shabbos Mevorchim. That's the goal!"
          }
        ]
      }
    ]
  },
  {
    "id": "myladder",
    "title": "My ladder",
    "items": [
      {
        "q": "Which ladder am I on?",
        "also": "What's my ladder? / What number am I?",
        "a": "You're on ladder {ladder}. You're training to say the whole Sefer Tehillim by {finishTrainingByGrade} grade. One step every Shabbos Mevorchim!",
        "data": "`ladder`, `finishTrainingByGrade`",
        "f": [
          {
            "q": "I don't have one",
            "a": "You haven't picked your ladder yet, {name}. Want help choosing one?"
          },
          {
            "q": "Is that a good ladder?",
            "a": "Every ladder gets you to the whole Tehillim! Ladder {ladder} is the one you chose. If it feels too easy, you can try a more challenging one."
          }
        ]
      },
      {
        "q": "Show me all the ladders",
        "a": "Here they are for this month: ladder {L}, {kapitlach} kapitlach and {minutes} minutes (one line per ladder). Which one do you want to hear about?",
        "data": "`ladderChoices`",
        "f": []
      },
      {
        "q": "Where do I see my ladder?",
        "a": "It's on your page under “Your Ladder.” It shows every month of the year, with your month highlighted.",
        "f": []
      }
    ]
  },
  {
    "id": "change",
    "title": "Changing my ladder",
    "items": [
      {
        "q": "Change me to ladder 8",
        "also": "I want ladder {n} / Switch me to ladder {n}",
        "a": "Ladder {n} means you say {kapitlach} kapitlach and {minutes} minutes this month. Do you want me to switch you to ladder {n}?",
        "action": "Spoken confirm first. On “yes,” call `changeLadder(n)`. Only ladders in `ladderChoices`. On success: “Done! You're now on ladder {n}. Hatzlacha!” On failure: “I couldn't save ladder {n} yet. Tap Switch my ladder on your page and choose it there.”",
        "note": "Today the voice switch only works before a kid has a ladder. Switching after that needs to be built.",
        "f": [
          {
            "q": "Yes",
            "a": "Done! You're now on ladder {n}. You're training to say the whole Tehillim by {n} grade. Hatzlacha!",
            "action": "changeLadder(n)"
          },
          {
            "q": "No, never mind",
            "a": "No problem, {name}! You're still on ladder {ladder}."
          }
        ]
      },
      {
        "q": "Change me to ladder 3",
        "also": "Any ladder not in my choices",
        "a": "Ladder {n} isn't one you can pick in {childGradeLabel} grade. You can choose ladder {list}.",
        "f": []
      },
      {
        "q": "Make it harder / I want a bigger quota",
        "a": "Let's look at ladder {next}. That's {kapitlach} kapitlach and {minutes} minutes this month. Want to switch?",
        "action": "Next lower number in `ladderChoices`, spoken confirm, then `changeLadder`",
        "f": [
          {
            "q": "Even harder!",
            "a": "Ladder {ladder} is already the most challenging ladder you can pick."
          }
        ]
      },
      {
        "q": "It's too much / Make it easier",
        "a": "Let's look at ladder {next}. That's {kapitlach} kapitlach and {minutes} minutes this month. Want to switch?",
        "action": "Next higher number in `ladderChoices`, spoken confirm, then `changeLadder`",
        "f": [
          {
            "q": "Even easier",
            "a": "Ladder {ladder} is already the easiest ladder you can pick."
          }
        ]
      },
      {
        "q": "Can I change back?",
        "a": "Yes! You can change your ladder later. Just tell me which one, or tap Switch my ladder on your page.",
        "f": [
          {
            "q": "How many times can I change?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "Does my parent need to say yes?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      },
      {
        "q": "What happens to my missions if I switch?",
        "a": "When you switch, the months you already did are checked again with the new ladder's quota.",
        "shimmy": true,
        "note": "This is how the code works. Should the commander warn the kid before a switch?",
        "f": []
      },
      {
        "q": "No (to the ladder offered)",
        "a": "Would you like to check out a more challenging ladder, or an easier one?",
        "f": [
          {
            "q": "No to both / I don't want any ladder",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "Maybe later",
            "a": "No problem, {name}! I'm right here whenever you need me."
          }
        ]
      },
      {
        "q": "(Kid did more than quota last month) “Would you like to go to a higher quota?”",
        "a": "Greeting: I see you did a great job last month. You did more than your quota. Would you like to go to a higher quota?",
        "f": [
          {
            "q": "Yes",
            "a": "Let's look at ladder {next}. That's {kapitlach} kapitlach and {minutes} minutes this month. Want me to switch you?",
            "action": "changeLadder(next) after spoken confirm"
          },
          {
            "q": "No",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      }
    ]
  },
  {
    "id": "quota",
    "title": "My quota and progress",
    "items": [
      {
        "q": "What do I say this month?",
        "also": "What's my quota? / What's my mission?",
        "a": "This month, Shabbos Mevorchim {month}, you say up to {kapitlachLabel}. That's {kapitlachQuota} kapitlach, about {minutesQuota} minutes. Say it this Shabbos Mevorchim and mark it done here. You've got this!",
        "data": "`thisMonth.month`, `thisMonth.kapitlachLabel`, `thisMonth.kapitlachQuota`, `thisMonth.minutesQuota`",
        "f": [
          {
            "q": "Where do I start?",
            "a": "Always from the beginning, kapitel 1, up to kapitel {kapitlachQuota}."
          },
          {
            "q": "What do the Hebrew letters mean?",
            "a": "{kapitlachLabel} means from kapitel 1 up to kapitel {kapitlachQuota}."
          },
          {
            "q": "What's a half, like up to half of 119?",
            "a": "It means you say through the middle of kapitel 119."
          },
          {
            "q": "Where is the middle of 119?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      },
      {
        "q": "How many have I said?",
        "a": "You said {kapitlachSaid} of {kapitlachQuota} kapitlach this month.",
        "data": "`thisMonth.kapitlachSaid`, `thisMonth.kapitlachQuota`",
        "f": [
          {
            "q": "How many are left?",
            "a": "Just {kapitlachQuota minus kapitlachSaid} more kapitlach to go!"
          },
          {
            "q": "Did I finish?",
            "a": "Yes: “And you already did it, wonderful!” No: “Not yet, {left} more to go. You've got this!”"
          }
        ]
      },
      {
        "q": "How am I doing?",
        "a": "You've completed {missionsTotal} missions. You've earned the {medal.current} medal, {missionsToNext} missions to {medal.next}. Keep it up, {name}!",
        "data": "`missionsTotal`, `medal.current`, `medal.next`, `medal.missionsToNext`",
        "f": []
      },
      {
        "q": "Is my quota the same every month?",
        "a": "Most months it goes up a little, so you climb step by step toward all 150 kapitlach.",
        "f": [
          {
            "q": "What's next month's quota?",
            "a": "Next month, on ladder {ladder}, you'll say {nextKapitlach} kapitlach and {nextMinutes} minutes."
          }
        ]
      },
      {
        "q": "Can I say more than my quota?",
        "a": "Of course! Every kapitel counts for your class, your school and the army. If you keep doing more, you might like a more challenging ladder.",
        "f": []
      }
    ]
  },
  {
    "id": "minutes",
    "title": "Minutes",
    "items": [
      {
        "q": "What are the minutes?",
        "also": "What's my minute quota?",
        "a": "Your minute quota this month is {minutesQuota} minutes. After Shabbos Mevorchim, put in the kapitlach you said and the minutes you said.",
        "data": "`thisMonth.minutesQuota`, `thisMonth.minutesSaid`",
        "f": [
          {
            "q": "Do I have to say it in exactly that many minutes?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "Do I need the minutes to finish my mission?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "How do I count my minutes?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "I don't know how long it took",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      }
    ]
  },
  {
    "id": "log",
    "title": "Saying and logging my Tehillim",
    "items": [
      {
        "q": "How do I put in my Tehillim?",
        "also": "How do I report? / Where do I write it?",
        "a": "Easy, {name}! On your page, type how many kapitlach and minutes you said in the boxes and tap Save. That's it! It counts for your class, your school and the whole army.",
        "f": [
          {
            "q": "When do I put it in?",
            "a": "Come back after Shabbos Mevorchim and put in what you said. You can put it in until the next Shabbos Mevorchim."
          },
          {
            "q": "I typed the wrong number",
            "a": "No problem! Type the right number in the box and tap Save again."
          },
          {
            "q": "I finished it!",
            "a": "That's amazing, {name}! I'm so proud of you. Make sure it's saved on your page so it counts. Onward and upward!"
          }
        ]
      },
      {
        "q": "I said 20 kapitlach, can you put it in for me?",
        "a": "I can direct you how to do it! On your page, type {n} in the “Kapitlach I said” box and your minutes in the “Minutes I said” box, then tap Save. That's it!",
        "note": "Sholem's answer: the commander guides the kid and does not enter numbers itself.",
        "f": []
      },
      {
        "q": "I forgot to put it in last month",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "note": "Your page only has boxes for this month.",
        "f": []
      },
      {
        "q": "Where do I say my Tehillim? In shul or at home?",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "f": [
          {
            "q": "Can I split it up during the day?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "Can I say it before Shabbos?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "I can't read Hebrew well yet",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      }
    ]
  },
  {
    "id": "mevorchim",
    "title": "Shabbos Mevorchim",
    "items": [
      {
        "q": "What is Shabbos Mevorchim?",
        "a": "Shabbos Mevorchim is the Shabbos before Rosh Chodesh, when we bless the new month. The minhag is to say the whole Tehillim that morning. That's our mission each month!",
        "f": [
          {
            "q": "What time do I say it?",
            "a": "The minhag is to say it in the morning. For more details, ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      },
      {
        "q": "When is the next Shabbos Mevorchim?",
        "also": "How many days until Shabbos Mevorchim?",
        "a": "The next Shabbos Mevorchim bentches {month}. That's in {daysUntil} days ({hebDate}). Get ready!",
        "data": "`nextShabbosMevorchim.month`, `.daysUntil`, `.hebDate`. Say “this Shabbos” at 0 days, “tomorrow” at 1.",
        "f": [
          {
            "q": "What do I do on Shabbos Mevorchim?",
            "a": "Say your kapitlach, from kapitel 1 up to {kapitlachQuota}. Then after Shabbos, put in what you said on your page."
          }
        ]
      },
      {
        "q": "Is there a Shabbos Mevorchim for Tishrei?",
        "a": "No. We don't bless Rosh Chodesh Tishrei, because it's Rosh Hashana.",
        "f": [
          {
            "q": "So when do I say my Tishrei Tehillim?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "Why are Rosh Hashana and Yom Kippur in my Tehillim Training?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      },
      {
        "q": "I'll be away that Shabbos",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "f": []
      }
    ]
  },
  {
    "id": "missed",
    "title": "If I miss a month",
    "items": [
      {
        "q": "(Kid missed last month) Greeting: “Where were you last month?”",
        "a": "Hi {name}, I'm your virtual commander. Where were you last month?",
        "f": [
          {
            "q": "I forgot / I was sick / I was busy",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      },
      {
        "q": "Can I make up a month I missed?",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "f": []
      },
      {
        "q": "Do I lose my medals if I miss?",
        "a": "No! Your missions and medals stay. A missed month just doesn't get a mission.",
        "f": [
          {
            "q": "Am I still on my ladder?",
            "a": "Yes, you're still on ladder {ladder}. Just keep going this month!"
          },
          {
            "q": "Does my class lose Perfect Platoon?",
            "a": "A class is a Perfect Platoon when every single soldier finishes that month. So your class is counting on you this month!"
          }
        ]
      },
      {
        "q": "I fell behind / It's too hard",
        "a": "I hear you, {name}. Even a little Tehillim is big. Start with a few kapitlach and see how it feels. I'm right here cheering you on. If it's too much, we can look at an easier ladder.",
        "f": []
      }
    ]
  },
  {
    "id": "medals",
    "title": "Missions and medals",
    "items": [
      {
        "q": "What is a mission?",
        "a": "A mission is finishing a month's quota. Say your kapitlach and put it in, and that's one mission! Missions earn you medals.",
        "f": [
          {
            "q": "How many missions do I have?",
            "a": "You've completed {missionsTotal} missions so far, {name}! {missionsToNext} more to your {medal.next} medal."
          }
        ]
      },
      {
        "q": "What medal do I have?",
        "a": "You've earned the {medal.current} medal! You're just {missionsToNext} missions from {medal.next}.",
        "data": "`medal.current`, `medal.next`, `medal.missionsToNext`",
        "f": [
          {
            "q": "I don't have one yet",
            "a": "No medal yet. Your first is the White medal at 5 missions."
          },
          {
            "q": "I have them all",
            "a": "You've earned every single medal. Wow!"
          }
        ]
      },
      {
        "q": "What are all the medals?",
        "a": "White at 5 missions, Red at 11, Orange at 18, Yellow at 26, Green at 35, Blue at 45, Purple at 56, Brown at 68, Gray at 81, and Black at 95. Black is the top!",
        "note": "The How It Works page says eleven medals up to Platinum. The medal code has ten, ending with Black.",
        "f": [
          {
            "q": "What medal should I have by now?",
            "a": "If you do every month, you'll have the Red medal, 11 missions, by the end of Pre-1A."
          },
          {
            "q": "Do I get a real medal?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      },
      {
        "q": "Where can I see my medals?",
        "a": "On your page, on the Medal Board. Every mission is a coin, and you can see each level.",
        "f": []
      },
      {
        "q": "What is My Tehillim Training?",
        "a": "It shows every mission from Pre-1A all the way to 12th grade: every Shabbos Mevorchim, plus Rosh Hashana and Yom Kippur. You're at {missionsTotal} missions.",
        "note": "That card counts 14 a grade, 182 in all. The Medals page counts to 95.",
        "f": [
          {
            "q": "Do my missions from last year count?",
            "a": "Yes! Your missions add up from year to year."
          }
        ]
      }
    ]
  },
  {
    "id": "ranks",
    "title": "Class and school ranks",
    "items": [
      {
        "q": "What's my class rank?",
        "also": "Are we winning?",
        "a": "Your class {className} is number {classRank} of {totalClasses} in {schoolName}. {needToPass} more soldiers finishing moves your class up!",
        "data": "`rank.className`, `rank.classRank`, `rank.totalClasses`, `rank.schoolName`, `rank.needToPass`. If `classRank` is 1: “Your class is in first place, amazing!”",
        "f": [
          {
            "q": "Which class is ahead of us?",
            "a": "{classAheadName} is just ahead. {needToPass} more soldiers finishing puts you ahead of them!"
          },
          {
            "q": "How are classes ranked?",
            "a": "By how many soldiers in the class finished their quota this month."
          },
          {
            "q": "What's my own rank in my class?",
            "a": "You're number {myRankInClass} of {classSize} in your class."
          }
        ]
      },
      {
        "q": "What's my school's rank?",
        "a": "Your school, {schoolName}, ranks number {schoolRank} of {totalSchools} worldwide.",
        "data": "`rank.schoolRank`, `rank.totalSchools`",
        "f": [
          {
            "q": "How are schools ranked?",
            "a": "On your page, by how many kapitlach the school said this month."
          },
          {
            "q": "Who's in first place?",
            "a": "Check the Race on the Home page to see the top schools!"
          }
        ]
      },
      {
        "q": "Is there a leaderboard for kids?",
        "a": "Yes! Your school's page shows the Top Soldiers.",
        "f": []
      }
    ]
  },
  {
    "id": "platoons",
    "title": "Perfect Platoons",
    "items": [
      {
        "q": "What's a Perfect Platoon?",
        "a": "A platoon is a class. It becomes a Perfect Platoon when every single soldier in it finishes their quota that month. Your part matters!",
        "f": [
          {
            "q": "Is my class a Perfect Platoon?",
            "a": "Yes: “Your class is a Perfect Platoon this month!” Not yet: “Not yet. {left} more soldiers need to finish.”"
          },
          {
            "q": "Where can I see them?",
            "a": "On the Home page and the Perfect Platoons page. Your school's page shows its own Perfect Platoons too."
          },
          {
            "q": "What do we get?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up. (Shimmy said Perfect Platoons get listed in the Battlefront Report. Confirm it's happening before the commander says it.)",
            "shimmy": true
          }
        ]
      },
      {
        "q": "Someone in my class didn't do it",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "note": "Shimmy warned kids can feel demoralized, so this needs careful wording.",
        "f": []
      }
    ]
  },
  {
    "id": "race",
    "title": "The worldwide race and stats",
    "items": [
      {
        "q": "What is the Race?",
        "a": "It's on the Home page: schools going head to head! You can see who has the most soldiers who finished, the most kapitlach, and the most time.",
        "f": [
          {
            "q": "How many kapitlach has the whole army said?",
            "a": "This month the army said {thisMonth} kapitlach, {thisYear} this year, and {allTime} all-time!"
          },
          {
            "q": "How many schools are in it?",
            "a": "There are {schools} schools, with {soldiers} soldiers!"
          },
          {
            "q": "How many Perfect Platoons are there?",
            "a": "This month there are {perfectPlatoons} Perfect Platoons!"
          }
        ]
      },
      {
        "q": "What are the Reports?",
        "a": "The Reports page shows how the army, each school (base), and each class (platoon) did each month.",
        "f": [
          {
            "q": "Can I see last month?",
            "a": "Yes! On the Reports page, tap the month you want."
          }
        ]
      },
      {
        "q": "What's a dedication?",
        "a": "Your school's page can show a dedication for the month.",
        "f": []
      }
    ]
  },
  {
    "id": "prizes",
    "title": "Prizes",
    "items": [
      {
        "q": "Are there prizes?",
        "also": "What do I win?",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up. (The site only has medals for missions.)",
        "shimmy": true,
        "f": [
          {
            "q": "What do I get for saying the whole Tehillim?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "What does the top school get?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          }
        ]
      }
    ]
  },
  {
    "id": "login",
    "title": "Logging in and out",
    "items": [
      {
        "q": "How do I log in?",
        "a": "Use your serial number and your date of birth on the Soldier Sign In page. Type the date like month, day, year.",
        "f": [
          {
            "q": "It says no soldier matches",
            "a": "Check your serial number and date of birth again. Still stuck? Ask your teacher or parent. They can get your serial for you."
          },
          {
            "q": "I forgot my serial number",
            "a": "Ask your teacher or parent. They can get your serial for you."
          }
        ]
      },
      {
        "q": "How do I log out?",
        "also": "Sign out",
        "a": "Tap Sign out at the top of your page. I'll be here again next time you log in!",
        "f": [
          {
            "q": "Why am I still logged in?",
            "a": "This browser keeps you signed in for 30 days, until you tap Sign out."
          },
          {
            "q": "My brother wants to use it",
            "a": "Tap Sign out first, then he can sign in with his own serial number."
          }
        ]
      },
      {
        "q": "My grade or class is wrong",
        "also": "Can I change my name?",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "f": []
      }
    ]
  },
  {
    "id": "parents",
    "title": "Parents and teachers",
    "items": [
      {
        "q": "Can my parents help me?",
        "a": "Yes! Your parents can help you pick a ladder and put in your Tehillim each month.",
        "f": [
          {
            "q": "Can my parents see how I'm doing?",
            "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
            "shimmy": true
          },
          {
            "q": "Is there a card I can print?",
            "a": "Yes! The Resources page has Quota Cards that show what to say each month."
          },
          {
            "q": "Is there a video?",
            "a": "A video tutorial is coming to the Resources page soon."
          }
        ]
      },
      {
        "q": "Who do I ask for help?",
        "also": "Who's my counselor?",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "f": []
      }
    ]
  },
  {
    "id": "voice",
    "title": "Voice and tech help",
    "items": [
      {
        "q": "I can't hear you",
        "a": "Check that the speaker button at the top of the chat isn't crossed out, and turn up your volume. If your browser kept me quiet, tap anywhere and I'll talk.",
        "f": [
          {
            "q": "Still nothing",
            "a": "You can read everything I say in the chat too."
          }
        ]
      },
      {
        "q": "Stop talking / Be quiet",
        "a": "(Stops right away.)",
        "action": "`stopSpeaking()`. In the phone-call version, the kid talking over the commander does this too. To stay quiet, the speaker button mutes, and the site remembers it.",
        "f": [
          {
            "q": "Talk again",
            "a": "I'm back!",
            "action": "Turn mute off"
          }
        ]
      },
      {
        "q": "You can't hear me",
        "a": "The microphone is blocked in this browser. You can still type.",
        "note": "Other mic error: “I could not use the microphone. You can still type.”",
        "f": [
          {
            "q": "Can I type instead?",
            "a": "Sure! Type in the box at the bottom and tap send."
          }
        ]
      },
      {
        "q": "Say that again",
        "a": "(Repeats the last line.)",
        "action": "Repeat last reply. Not built yet.",
        "f": []
      },
      {
        "q": "Talk slower / faster",
        "a": "Not in the site yet. Suggested answer: ask your counselor or a grown-up.",
        "shimmy": true,
        "f": []
      },
      {
        "q": "My page says it couldn't load",
        "a": "Tap Try again on your page. If it still doesn't work, ask a grown-up.",
        "f": []
      },
      {
        "q": "How do I close you?",
        "a": "Tap the X at the top. To bring me back, tap “Hi! Need help?”",
        "f": []
      }
    ]
  }
]
