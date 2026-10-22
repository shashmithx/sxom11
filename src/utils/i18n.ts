export const translations = {
  en: {
    appTitle: 'SHANEX OMI',
    appSubtitle: 'Authentic Sri Lankan Online P2P Multiplayer OMI',
    lobbyTitle: 'OMI GAME LOBBY',
    playerName: 'Player Name',
    enterName: 'Enter your name...',
    createRoom: 'Create New Room',
    joinRoom: 'Join Room',
    roomCode: 'Room Code',
    enterRoomCode: 'e.g. OMI-7421',
    shareLink: 'Share Invite Link',
    linkCopied: 'Link Copied to Clipboard!',
    teamMode: 'Team Arrangement',
    modeSameTeam: 'MODE A: SAME TEAM (Partners)',
    modeSameTeamDesc: 'Human 1 + Human 2 VS AI Bot 1 + AI Bot 2 (Sit Opposite)',
    modeOppositeTeams: 'MODE B: OPPOSITE TEAMS (Rivals)',
    modeOppositeTeamsDesc: 'Human 1 + Bot 1 VS Human 2 + Bot 2 (Sit Cross)',
    botDifficulty: 'AI Bot Difficulty',
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    waitingForPlayer2: 'Waiting for Player 2 to join...',
    player2Connected: 'Player 2 connected! Ready to play.',
    startGame: 'Start OMI Match',
    ready: 'Ready',
    connecting: 'Connecting WebRTC P2P...',
    connectedP2P: 'WebRTC P2P Direct',
    connectedRelay: 'Live Relay',
    disconnected: 'Disconnected',
    latency: 'Latency',
    trumpSuit: 'Trump Suit',
    selectTrump: 'Select Trump Suit',
    selectTrumpPrompt: 'Choose the trump suit based on your first 4 cards:',
    spades: 'Spades',
    hearts: 'Hearts',
    diamonds: 'Diamonds',
    clubs: 'Clubs',
    yourTurn: 'YOUR TURN',
    waitingTurn: 'Waiting for {name}...',
    tricks: 'Tricks',
    tokens: 'Tokens',
    carried: 'Carried',
    dealer: 'Dealer',
    trumpChooser: 'Trump Caller',
    lastTrick: 'Last Trick',
    noLastTrick: 'No completed trick yet this hand.',
    howToPlay: 'How to Play OMI',
    howToPlayContent: `Rules of Sri Lankan OMI:
• 4 Players seated in cross; opposite seats are partners.
• 32 cards (A, K, Q, J, 10, 9, 8, 7 of 4 suits).
• Ace is highest, 7 is lowest. Play moves counter-clockwise.
• First 4 cards dealt; player to dealer's right chooses Trump suit.
• Remaining 4 cards dealt (8 cards per player).
• Trump caller leads first trick. Players MUST follow lead suit if possible.
• If void in lead suit, you may cut with Trump or discard any card.
• Highest trump wins; otherwise highest card of lead suit wins.
• 8 tricks total per hand.
Scoring:
- Trump team wins 5-7 tricks: 1 token (+ carried)
- Defending team wins 5-7 tricks: 2 tokens (+ carried)
- Either team wins all 8 tricks: KAPOTHI! 3 tokens (+ carried)
- 4-4 tie: Draw (Bada). 1 token carried to next round.
- First team to 10 tokens wins the Match!`,
    kapothiBanner: 'KAPOTHI! All 8 tricks swept!',
    badaBanner: '4–4 DRAW (බඩ)! 1 token carried forward.',
    roundOver: 'Round Finished',
    matchWinner: 'MATCH WINNER!',
    team1Wins: 'Team 1 (Blue) Wins the Match!',
    team2Wins: 'Team 2 (Red) Wins the Match!',
    rematch: 'Play Rematch',
    nextHand: 'Start Next Hand',
    soundOn: 'Sound: ON',
    soundOff: 'Sound: OFF',
    manualWebRTC: 'Manual WebRTC',
    manualPrompt: 'Direct Manual SDP Pair (Fallback):',
    copyOffer: 'Copy Offer',
    pasteAnswer: 'Paste Answer',
    apply: 'Apply & Connect',
    reactionTitle: 'Send Reaction',
    partnerBadge: 'PARTNER',
    opponentBadge: 'OPPONENT',
    youBadge: 'YOU',
    botBadge: 'AI BOT',
    legalCardHint: 'Click a highlighted card to play',
    mustFollowSuit: 'Must follow suit: {suit}',
  },
  si: {
    appTitle: 'ෂැනෙක්ස් ඔමි',
    appSubtitle: 'ශ්‍රී ලාංකික සැබෑ ඔන්ලයින් ඔමි ක්‍රීඩාව (P2P)',
    lobbyTitle: 'ඔමි ක්‍රීඩා කාමරය',
    playerName: 'ක්‍රීඩකයාගේ නම',
    enterName: 'ඔබේ නම ඇතුළත් කරන්න...',
    createRoom: 'නව කාමරයක් සාදන්න',
    joinRoom: 'කාමරයට එකතු වන්න',
    roomCode: 'කාමර අංකය',
    enterRoomCode: 'උදා: OMI-7421',
    shareLink: 'ආරාධනා ලින්ක් එක කොපි කරන්න',
    linkCopied: 'ලින්ක් එක කොපි කරගන්නා ලදී!',
    teamMode: 'පිල් බෙදීමේ ක්‍රමය',
    modeSameTeam: 'ක්‍රමය A: එකම පිල (මිතුරන්)',
    modeSameTeamDesc: 'ක්‍රීඩක 1 + ක්‍රීඩක 2 එදිරිව AI Bot 1 + AI Bot 2 (ඉදිරිපිට වාඩිවෙයි)',
    modeOppositeTeams: 'ක්‍රමය B: දෙපිල (තරඟකරුවන්)',
    modeOppositeTeamsDesc: 'ක්‍රීඩක 1 + Bot 1 එදිරිව ක්‍රීඩක 2 + Bot 2 (හරහට වාඩිවෙයි)',
    botDifficulty: 'AI Bot අපහසුතාව',
    easy: 'සරල (Easy)',
    normal: 'සාමාන්‍ය (Normal)',
    hard: 'දක්ෂ (Hard)',
    waitingForPlayer2: 'දෙවන ක්‍රීඩකයා සම්බන්ධ වනතුරු රැඳී සිටින්න...',
    player2Connected: 'දෙවන ක්‍රීඩකයා සම්බන්ධ විය! සූදානම්.',
    startGame: 'තරගය ආරම්භ කරන්න',
    ready: 'සූදානම්',
    connecting: 'P2P සම්බන්ධ වෙමින් පවතී...',
    connectedP2P: 'WebRTC P2P සෘජු සබඳතාව',
    connectedRelay: 'සජීවී රිලේ සබඳතාව',
    disconnected: 'විසන්ධි විය',
    latency: 'ප්‍රමාදය (Latency)',
    trumpSuit: 'තුරුම්පු පාට',
    selectTrump: 'තුරුම්පු තෝරන්න',
    selectTrumpPrompt: 'මුල් කාඩ්පත් 4 අනුව තුරුම්පු පාට තෝරන්න:',
    spades: 'ඉස්පික (Spades)',
    hearts: 'හර්ත (Hearts)',
    diamonds: 'රූබ (Diamonds)',
    clubs: 'කලාවර (Clubs)',
    yourTurn: 'ඔබේ වාරය',
    waitingTurn: '{name} ගේ වාරය...',
    tricks: 'දිනූ අත්',
    tokens: 'කැට',
    carried: 'ඉදිරියට ගෙන ආ',
    dealer: 'බෙදන්නා',
    trumpChooser: 'තුරුම්පුකරු',
    lastTrick: 'පසුගිය අත',
    noLastTrick: 'තවම අවසන් වූ අතක් නොමැත.',
    howToPlay: 'ඔමි ක්‍රීඩා නීති',
    howToPlayContent: `ශ්‍රී ලාංකික ඔමි ක්‍රීඩා නීති:
• ක්‍රීඩකයින් 4 දෙනෙකි; මුහුණට මුහුණ සිටින දෙදෙනා එකම පිලයි.
• කාඩ්පත් 32කි (A, K, Q, J, 10, 9, 8, 7).
• ඒස් (A) ලොකුම කාඩ්පත වන අතර 7 කුඩාම වේ. වාමාවර්තව (දකුණට) වටය කැරකේ.
• මුලින් කාඩ් 4 බැගින් බෙදයි. බෙදන්නාගේ දකුණුපස ක්‍රීඩකයා තුරුම්පු කියයි.
• ඉතිරි කාඩ් 4 බෙදයි (එක් අයෙකුට කාඩ් 8යි).
• තුරුම්පුකරු පළමු අත අදියි. අදින ලද පාටින් කාඩ් ඔබ සතුව ඇත්නම් අනිවාර්යයෙන්ම එම පාටින්ම දැමිය යුතුය.
• එම පාට නැතිනම් තුරුම්පුවෙන් කැපීමට හෝ වෙනත් පාටක් හැලීමට හැකිය.
• ඉහළම තුරුම්පුවට හෝ (තුරුම්පු නැතිනම්) අදින ලද පාටෙහි ඉහළම කාඩ්පතට අත හිමිවේ.
• එක් වටයකට අත් 8කි.
ලකුණු සහ කැට:
- තුරුම්පු පිල අත් 5-7 දිනුවොත්: කැට 1 (+ ඉදිරියට ගෙන ආ කැට)
- විරුද්ධ පිල අත් 5-7 දිනුවොත්: කැට 2 (+ ඉදිරියට ගෙන ආ කැට)
- අත් 8 ම දිනුවොත්: කපෝති! කැට 3 (+ ඉදිරියට ගෙන ආ කැට)
- 4-4 සම වුවහොත්: බඩ! ඊළඟ වටයට කැට 1ක් ඉදිරියට යයි.
- පළමුව කැට 10 සම්පූර්ණ කරන පිල ජයග්‍රහණය කරයි!`,
    kapothiBanner: 'කපෝති! අත් 8 ම දිනාගන්නා ලදී!',
    badaBanner: 'බඩ (4–4 සමයි)! කැට 1ක් ඊළඟ අතට.',
    roundOver: 'වටය අවසන්',
    matchWinner: 'තරගයේ ජයග්‍රාහකයා!',
    team1Wins: 'නිල් පිල (Team 1) තරගය ජයග්‍රහණය කළා!',
    team2Wins: 'රතු පිල (Team 2) තරගය ජයග්‍රහණය කළා!',
    rematch: 'නැවත තරගයක්',
    nextHand: 'ඊළඟ අත පටන්ගන්න',
    soundOn: 'ශබ්දය: ඔන්',
    soundOff: 'ශබ්දය: ඕෆ්',
    manualWebRTC: 'අතින් සම්බන්ධ කිරීම',
    manualPrompt: 'සෘජු SDP හුවමාරුව:',
    copyOffer: 'Offer කොපි කරන්න',
    pasteAnswer: 'Answer පේස්ට් කරන්න',
    apply: 'සම්බන්ධ කරන්න',
    reactionTitle: 'ප්‍රතිචාර යවන්න',
    partnerBadge: 'සහකරු',
    opponentBadge: 'විරුද්ධවාදී',
    youBadge: 'ඔබ',
    botBadge: 'AI BOT',
    legalCardHint: 'දැමිය හැකි කාඩ්පතක් තෝරන්න',
    mustFollowSuit: 'අදින ලද පාට දැමිය යුතුයි: {suit}',
  },
};
