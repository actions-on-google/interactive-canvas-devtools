/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {
  conversation,
  Canvas,
} = require('@assistant/conversation');
const functions = require('firebase-functions');

const app = conversation({debug: true});

const MAX_INCORRECT_GUESSES = 5;

const NEW_GREETING = `Welcome to Snow Pal!`;

const RETURNING_GREETINGS = [`Hey, you're back to Snow Pal!`,
  `Welcome back to Snow Pal!`,
  `I'm glad you're back to play!`,
  `Hey there, you made it! Let's play Snow Pal`];

const PLAY_AGAIN_INSTRUCTIONS = `Would you like to  play again or quit?`;

const WIN_RESPONSES = ['Congratulations and BRAVO!',
  'You did it! So proud of you!',
  'Well done!', 'I’m happy for you!',
  'This is awesome! You’re awesome! Way to go!'];

const CORRECT_RESPONSES = ['Right on! Good guess.', 'Splendid!',
  'Wonderful! Keep going!', 'Easy peasy lemon squeezy!', 'Easy as pie!'];

const INCORRECT_RESPONSES = [`Try again!`, 'You can do this!',
  'Incorrect. Keep on trying!'];

/**
 * Pick a random item from an array. This is to make
 * responses more conversational.
 *
 * @param  {array} array representing a list of elements.
 * @return  {string} item from an array.
 */
const randomArrayItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

app.handle('greeting', (conv) => {
  if (!conv.device.capabilities.includes('INTERACTIVE_CANVAS')) {
    conv.add('Sorry, this device does not support Interactive Canvas!');
    conv.scene.next.name = 'actions.page.END_CONVERSATION';
    return;
  }
  if (conv.user.lastSeenTime === undefined){
    conv.add(`<speak>${NEW_GREETING}</speak>`);
  } else {
    conv.add(`<speak>${randomArrayItem(RETURNING_GREETINGS)}</speak>`);
  }
  conv.add('Would you like to start playing the game?');
});

app.handle('guess', (conv) => {
  const letterOrWord = conv.intent.params.letter ? conv.intent.params.letter.resolved :
    conv.intent.params.word ? conv.intent.params.word.resolved : null;

  guess = letterOrWord.toUpperCase();
  const correctWord = conv.context.canvas.state.correctWord;

  let correctGuess = correctWord.indexOf(guess) > -1 &&
    (guess.length == 1 || guess.length == correctWord.length);
  if (correctGuess) {
    // Update the word to be displayed to the user with the newly guessed letter.
    displayedWord = getUpdatedDisplayedWord(conv, guess);

    const userHasWon = correctWord === displayedWord;
    if (userHasWon) {
      conv.add(`<speak>Let's see if your guess is there...<break
        time='2500ms'/> ${guess} is right. <mark name="code"/>
        That spells ${correctWord}!
        ${randomArrayItem(WIN_RESPONSES)}</speak>`);
      conv.add(new Canvas({
        data: {
          command: 'WIN_GAME',
          displayedWord: displayedWord
        },
      }));
      conv.add(`<speak>${PLAY_AGAIN_INSTRUCTIONS}</speak>`);
    } else {
      conv.add(`<speak>Let's see if your guess is there...<break
      time='2500ms'/> ${guess} is right.</speak>`);
      conv.add(new Canvas({
        data: {
          command: 'CORRECT_ANSWER',
          displayedWord: displayedWord
        },
      }));
      conv.add(`<speak>${randomArrayItem(CORRECT_RESPONSES)}</speak>`);
    }
  }
  else {
  // Check if the user has exceeded the maximum amount of max guesses allowed.
    const userHasLost = conv.context.canvas.state.incorrectGuesses + 1 >= MAX_INCORRECT_GUESSES;
    if (userHasLost) {
      conv.add(`<speak>Let's see if your guess is there...<break
      time='2500ms'/> ${guess} is wrong. Sorry you lost. The word is ${correctWord}!</speak>`);
      conv.add(new Canvas({
        data: {
          command: 'LOSE_GAME',
        },
      }));
      conv.add(`<speak>${PLAY_AGAIN_INSTRUCTIONS}</speak>`);
    } else {
      conv.add(`<speak>Let's see if your guess is there...<break
      time='2500ms'/>  ${guess} is wrong.</speak>`);
      conv.add(new Canvas({
        data: {
          command: 'INCORRECT_ANSWER',
        },
      }));
      conv.add(`<speak>${randomArrayItem(INCORRECT_RESPONSES)}</speak>`);
    }
  }
});

function getUpdatedDisplayedWord(conv, guess) {
  const correctWord = conv.context.canvas.state.correctWord;
  let displayedWord = conv.context.canvas.state.displayedWord;
  if(guess === correctWord) {
    displayedWord = correctWord;
  } else {
    correctWord.split('').forEach((letter, index) => {
      if (guess === letter) {
        displayedWord = displayedWord.substr(0, index) +
        guess + displayedWord.substr(index + guess.length);
      }
    });
  }
  return displayedWord;
}

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
