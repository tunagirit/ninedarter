import { getState } from './store.js';

const tr = {
  'nav.play': 'Oyna', 'nav.players': 'Oyuncular', 'nav.stats': 'İstatistik', 'nav.history': 'Geçmiş', 'nav.settings': 'Ayarlar',
  'home.quick': 'Hızlı maç', 'home.resume': 'Devam eden maç', 'home.kicker': 'Dart skor tutucu', 'home.title': 'Her ok sayılır.', 'home.newGame': 'Yeni maç', 'home.modes': 'Oyun modları', 'home.recent': 'Son maçlar',
  'common.continue': 'Devam et', 'common.cancel': 'Vazgeç', 'common.back': 'Geri', 'common.add': 'Ekle', 'common.remove': 'Kaldır', 'common.close': 'Kapat', 'common.ok': 'Tamam', 'common.delete': 'Sil', 'common.save': 'Kaydet', 'common.edit': 'Düzenle',
  'game.abandonQ': 'Maç iptal edilsin mi?', 'game.abandonText': 'Bu maçın tüm skorları silinir ve istatistiklere eklenmez.', 'game.abandon': 'Maçı iptal et', 'game.pauseTitle': 'Maç duraklatıldı', 'game.pauseText': 'Maçı daha sonra kaldığın yerden sürdürebilirsin.', 'game.later': 'Sonra devam et',
  'game.undo': 'Geri al', 'game.undone': 'Son tur geri alındı', 'game.matchWon': '{name} maçı kazandı!', 'game.setWon': '{name} seti aldı', 'game.legWon': '{name} leg\'i aldı',
  'game.checkoutQ': 'Checkout! 🎯', 'game.dartsUsed': 'Kullanılan dart', 'game.dartsAtDouble': 'Double\'a atılan dart', 'game.dartsAtDoubleQ': 'Double\'a kaç dart attın?',
  'game.set': 'Set', 'game.leg': 'Leg', 'game.liveStats': 'Canlı istatistik', 'game.inputMode': 'Giriş modu', 'game.dartsN': '{n} dart', 'game.last': 'Son', 'game.bust': 'Bust',
  'game.botThinking': '{name} atıyor…', 'game.enterScore': 'Skor gir', 'game.delete': 'Sil', 'game.noScore': 'Sayı yok', 'game.single': 'Tek', 'game.double': 'Double', 'game.treble': 'Triple', 'game.miss': 'Iska',
  'game.round': 'Tur', 'game.restMiss': 'Bitir', 'game.target': 'hedef', 'game.hit': 'İsabet', 'game.hitsQ': 'Kaç isabet?', 'game.checkoutThis': 'Bunu bitir', 'game.finishedWith': 'Kaç dartta bitirdin?', 'game.missed': 'Bitiremedim',
  'mode.x01': 'X01', 'mode.x01.desc': '501, 301 ve özel başlangıçlar. Double/Master in-out, set ve leg formatları.',
  'mode.cricket': 'Cricket', 'mode.cricket.desc': '15–20 ve Bull. Standart veya Cut-throat.',
  'mode.atc': 'Saat Yönünde', 'mode.atc.desc': '1\'den 20\'ye ve Bull\'a, sırayla vur.', 'mode.atc.long': 'Sırasıyla 1\'den 20\'ye (ve isteğe bağlı Bull) kadar her hedefi vur. En az dartla bitiren kazanır.',
  'mode.bobs27': 'Bob\'s 27', 'mode.bobs27.desc': 'Double antrenmanı. 27 puanla başla, sıfırın altına düşme.', 'mode.bobs27.long': '27 puanla başlarsın. Her turda D1\'den D20\'ye ve Bull\'a 3 dart atarsın. Her isabet double değerini ekler; hiç isabet yoksa double değeri düşülür. Puanın sıfırın altına inerse oyun biter.',
  'mode.checkout': 'Checkout', 'mode.checkout.desc': 'Rastgele bitişlerle bitiriş antrenmanı.', 'mode.checkout.long': 'Seçilen aralıktan rastgele bir sayı gelir; 3 dartta double ile bitirmeye çalış. Önerilen yol gösterilir.',
  'setup.firstTo': 'İlk', 'setup.sets': 'set', 'setup.set': 'set', 'setup.leg': 'leg', 'setup.legs': 'leg', 'setup.cutthroat': 'Cut-throat', 'setup.atc.any': 'Herhangi', 'setup.atc.double': 'Double', 'setup.atc.treble': 'Triple',
  'setup.needPlayer': 'En az bir oyuncu seç', 'setup.shuffled': 'Sıra karıştırıldı', 'setup.players': 'Oyuncular', 'setup.shuffle': 'Karıştır', 'setup.bot': 'Bot', 'setup.level': 'Seviye', 'setup.addBot': 'Bot ekle',
  'setup.startScore': 'Başlangıç skoru', 'setup.custom': 'Özel', 'setup.in': 'Giriş', 'setup.out': 'Çıkış', 'setup.format': 'Format', 'setup.bestOf': 'En iyi', 'setup.legsPerSet': 'Set başına leg', 'setup.eachSet': 'her sette ilk',
  'setup.variant': 'Varyant', 'setup.standard': 'Standart', 'setup.roundLimit': 'Tur limiti', 'setup.none': 'Yok',
  'setup.standard.desc': 'Bir sayıyı kapattıktan sonra rakipler kapatmadıkça puan toplarsın. Tümünü kapatıp puanda önde olan kazanır.',
  'setup.cutthroat.desc': 'Kapattığın sayıdaki fazla isabetler, o sayıyı kapatmamış rakiplere puan olarak yazılır. Tümünü kapatıp en düşük puana sahip olan kazanır.',
  'setup.target': 'Hedef', 'setup.includeBull': 'Bull ile bitir', 'setup.range': 'Aralık', 'setup.rounds': 'Tur sayısı', 'setup.start': 'Başla',
  'rule.straight': 'Straight', 'rule.double': 'Double', 'rule.master': 'Master',
  'players.new': 'Yeni oyuncu', 'players.name': 'Oyuncu adı', 'players.add': 'Oyuncu ekle', 'players.color': 'Renk', 'players.shape': 'Şekil', 'players.deleteQ': '{name} silinsin mi?', 'players.deleteText': 'Oyuncu silinir; geçmiş maç kayıtları korunur.', 'players.deleted': 'Oyuncu silindi', 'players.noGames': 'Henüz maç yok', 'players.empty': 'Henüz oyuncu yok', 'players.emptyText': 'İstatistiklerini takip etmek için oyuncu ekle.',
  'stats.avgShort': 'ort.', 'stats.avg': '3 dart ort.', 'stats.avg3': '3 dart ortalaması', 'stats.first9': 'İlk 9 ort.', 'stats.coPct': 'Checkout %', 'stats.checkouts': 'Checkout', 'stats.checkout': 'checkout', 'stats.dblDarts': 'Double dartı', 'stats.hiCo': 'En yüksek bitiriş', 'stats.bestLeg': 'En iyi leg', 'stats.dartsShort': 'dart', 'stats.high': 'En yüksek tur', 'stats.darts': 'Atılan dart', 'stats.busts': 'Bust',
  'stats.mpr': 'Tur başına işaret (MPR)', 'stats.marks': 'İşaret', 'stats.fivePlus': '5+ işaretli tur', 'stats.highMarks': 'En çok işaret', 'stats.rounds': 'Tur', 'stats.legsWon': 'Kazanılan leg', 'stats.hitPct': 'İsabet %', 'stats.progress': 'İlerleme', 'stats.score': 'Puan', 'stats.successRate': 'Başarı %', 'stats.attempts': 'Deneme', 'stats.bestCo': 'En yüksek bitiriş',
  'stats.needMore': 'Grafik için en az 2 maç gerekli', 'stats.empty': 'Henüz istatistik yok', 'stats.emptyText': 'Önce bir oyuncu ekleyip maç oyna.', 'stats.matches': 'Maç', 'stats.matchesShort': 'maç', 'stats.winPct': 'Kazanma %', 'stats.avgTrend': 'Ortalama gelişimi', 'stats.played': 'Oynanan', 'stats.bestDarts': 'En az dart', 'stats.bestScore': 'En iyi puan', 'stats.avgScore': 'Ortalama puan', 'stats.noData': 'Bu modda veri yok', 'stats.noDataText': 'Bu oyuncuyla bir maç bitir, istatistikler burada görünsün.',
  'result.notFound': 'Maç bulunamadı', 'result.winner': 'Kazanan', 'result.done': 'Tamamlandı!', 'result.min': 'dk', 'result.rematch': 'Rövanş', 'result.stats': 'Maç istatistikleri', 'result.legs': 'Leg\'ler', 'result.deleteQ': 'Maç silinsin mi?', 'result.deleteText': 'Bu maç geçmişten ve istatistiklerden kaldırılır.',
  'history.all': 'Tümü', 'history.training': 'Antrenman', 'history.empty': 'Henüz maç yok', 'history.emptyText': 'Bitirdiğin maçlar burada listelenir.',
  'settings.appearance': 'Görünüm', 'settings.system': 'Sistem', 'settings.light': 'Açık', 'settings.dark': 'Koyu', 'settings.color': 'Tema rengi', 'settings.language': 'Dil', 'settings.game': 'Oyun',
  'settings.caller': 'Skor anonsu', 'settings.callerSub': 'Skorları sesli okur', 'settings.defaultVoice': 'Varsayılan ses', 'settings.vibrate': 'Titreşim', 'settings.hints': 'Checkout önerileri', 'settings.hintsSub': '170 ve altında bitiriş yolunu göster',
  'settings.askDoubles': 'Double dartlarını sor', 'settings.askDoublesSub': 'Doğru checkout % için', 'settings.input': 'Varsayılan giriş', 'settings.keypad': 'Toplam skor', 'settings.perDart': 'Dart dart', 'settings.botSpeed': 'Bot hızı', 'settings.slow': 'Yavaş', 'settings.normal': 'Normal', 'settings.fast': 'Hızlı',
  'settings.data': 'Veri', 'settings.export': 'Yedekle', 'settings.exportSub': 'Tüm oyuncu ve maçları JSON olarak indir', 'settings.exportBtn': 'İndir', 'settings.import': 'Yedekten geri yükle', 'settings.importBtn': 'Yükle', 'settings.reset': 'Sıfırla', 'settings.resetSub': 'Tüm verileri sil',
  'settings.resetQ': 'Tüm veriler silinsin mi?', 'settings.resetText': 'Oyuncular, maçlar ve ayarlar kalıcı olarak silinir. Bu işlem geri alınamaz.', 'settings.resetDone': 'Tüm veriler silindi', 'settings.imported': 'Yedek yüklendi', 'settings.importFail': 'Geçersiz yedek dosyası', 'settings.about': 'Material 3 Expressive dart skor uygulaması. Veriler yalnızca bu cihazda saklanır.',
};

const en = {
  'nav.play': 'Play', 'nav.players': 'Players', 'nav.stats': 'Stats', 'nav.history': 'History', 'nav.settings': 'Settings',
  'home.quick': 'Quick match', 'home.resume': 'Match in progress', 'home.kicker': 'Darts scorer', 'home.title': 'Every dart counts.', 'home.newGame': 'New match', 'home.modes': 'Game modes', 'home.recent': 'Recent matches',
  'common.continue': 'Continue', 'common.cancel': 'Cancel', 'common.back': 'Back', 'common.add': 'Add', 'common.remove': 'Remove', 'common.close': 'Close', 'common.ok': 'OK', 'common.delete': 'Delete', 'common.save': 'Save', 'common.edit': 'Edit',
  'game.abandonQ': 'Abandon match?', 'game.abandonText': 'All scores of this match will be discarded and not counted in stats.', 'game.abandon': 'Abandon match', 'game.pauseTitle': 'Match paused', 'game.pauseText': 'You can resume this match later right where you left off.', 'game.later': 'Resume later',
  'game.undo': 'Undo', 'game.undone': 'Last visit undone', 'game.matchWon': '{name} wins the match!', 'game.setWon': '{name} takes the set', 'game.legWon': '{name} takes the leg',
  'game.checkoutQ': 'Checkout! 🎯', 'game.dartsUsed': 'Darts used', 'game.dartsAtDouble': 'Darts at double', 'game.dartsAtDoubleQ': 'How many darts at a double?',
  'game.set': 'Set', 'game.leg': 'Leg', 'game.liveStats': 'Live stats', 'game.inputMode': 'Input mode', 'game.dartsN': '{n} darts', 'game.last': 'Last', 'game.bust': 'Bust',
  'game.botThinking': '{name} is throwing…', 'game.enterScore': 'Enter score', 'game.delete': 'Delete', 'game.noScore': 'No score', 'game.single': 'Single', 'game.double': 'Double', 'game.treble': 'Treble', 'game.miss': 'Miss',
  'game.round': 'Round', 'game.restMiss': 'Done', 'game.target': 'target', 'game.hit': 'Hit', 'game.hitsQ': 'How many hits?', 'game.checkoutThis': 'Check this out', 'game.finishedWith': 'Finished with how many darts?', 'game.missed': 'Missed',
  'mode.x01': 'X01', 'mode.x01.desc': '501, 301 and custom starts. Double/Master in-out, sets & legs.',
  'mode.cricket': 'Cricket', 'mode.cricket.desc': '15–20 and Bull. Standard or Cut-throat.',
  'mode.atc': 'Around the Clock', 'mode.atc.desc': 'Hit 1 to 20 and Bull, in order.', 'mode.atc.long': 'Hit every target in order from 1 to 20 (and optionally Bull). Fewest darts wins.',
  'mode.bobs27': 'Bob\'s 27', 'mode.bobs27.desc': 'Doubles practice. Start on 27, don\'t drop below zero.', 'mode.bobs27.long': 'Start with 27 points. Each round throw 3 darts at D1 through D20 and Bull. Each hit adds the double\'s value; no hits subtracts it. Game over if you drop below zero.',
  'mode.checkout': 'Checkout', 'mode.checkout.desc': 'Finishing practice with random outs.', 'mode.checkout.long': 'A random number from the chosen range appears; try to finish it on a double within 3 darts. The suggested route is shown.',
  'setup.firstTo': 'First to', 'setup.sets': 'sets', 'setup.set': 'set', 'setup.leg': 'leg', 'setup.legs': 'legs', 'setup.cutthroat': 'Cut-throat', 'setup.atc.any': 'Any', 'setup.atc.double': 'Doubles', 'setup.atc.treble': 'Trebles',
  'setup.needPlayer': 'Pick at least one player', 'setup.shuffled': 'Order shuffled', 'setup.players': 'Players', 'setup.shuffle': 'Shuffle', 'setup.bot': 'Bot', 'setup.level': 'Level', 'setup.addBot': 'Add bot',
  'setup.startScore': 'Starting score', 'setup.custom': 'Custom', 'setup.in': 'In', 'setup.out': 'Out', 'setup.format': 'Format', 'setup.bestOf': 'Best of', 'setup.legsPerSet': 'Legs per set', 'setup.eachSet': 'each set first to',
  'setup.variant': 'Variant', 'setup.standard': 'Standard', 'setup.roundLimit': 'Round limit', 'setup.none': 'None',
  'setup.standard.desc': 'Once you close a number you score on it until opponents close it. Close everything while leading on points to win.',
  'setup.cutthroat.desc': 'Extra hits on numbers you closed are added to opponents who haven\'t closed them. Close everything with the lowest score to win.',
  'setup.target': 'Target', 'setup.includeBull': 'Finish on Bull', 'setup.range': 'Range', 'setup.rounds': 'Rounds', 'setup.start': 'Start',
  'rule.straight': 'Straight', 'rule.double': 'Double', 'rule.master': 'Master',
  'players.new': 'New player', 'players.name': 'Player name', 'players.add': 'Add player', 'players.color': 'Color', 'players.shape': 'Shape', 'players.deleteQ': 'Delete {name}?', 'players.deleteText': 'The player is removed; past match records are kept.', 'players.deleted': 'Player deleted', 'players.noGames': 'No matches yet', 'players.empty': 'No players yet', 'players.emptyText': 'Add players to track their stats.',
  'stats.avgShort': 'avg', 'stats.avg': '3-dart avg', 'stats.avg3': '3-dart average', 'stats.first9': 'First 9 avg', 'stats.coPct': 'Checkout %', 'stats.checkouts': 'Checkouts', 'stats.checkout': 'checkout', 'stats.dblDarts': 'Darts at double', 'stats.hiCo': 'Highest finish', 'stats.bestLeg': 'Best leg', 'stats.dartsShort': 'darts', 'stats.high': 'Highest score', 'stats.darts': 'Darts thrown', 'stats.busts': 'Busts',
  'stats.mpr': 'Marks per round (MPR)', 'stats.marks': 'Marks', 'stats.fivePlus': '5+ mark rounds', 'stats.highMarks': 'Most marks', 'stats.rounds': 'Rounds', 'stats.legsWon': 'Legs won', 'stats.hitPct': 'Hit %', 'stats.progress': 'Progress', 'stats.score': 'Score', 'stats.successRate': 'Success %', 'stats.attempts': 'Attempts', 'stats.bestCo': 'Highest finish',
  'stats.needMore': 'Play at least 2 matches to see a chart', 'stats.empty': 'No stats yet', 'stats.emptyText': 'Add a player and play a match first.', 'stats.matches': 'Matches', 'stats.matchesShort': 'matches', 'stats.winPct': 'Win %', 'stats.avgTrend': 'Average trend', 'stats.played': 'Played', 'stats.bestDarts': 'Fewest darts', 'stats.bestScore': 'Best score', 'stats.avgScore': 'Average score', 'stats.noData': 'No data for this mode', 'stats.noDataText': 'Finish a match with this player to see stats here.',
  'result.notFound': 'Match not found', 'result.winner': 'Winner', 'result.done': 'Completed!', 'result.min': 'min', 'result.rematch': 'Rematch', 'result.stats': 'Match stats', 'result.legs': 'Legs', 'result.deleteQ': 'Delete match?', 'result.deleteText': 'This match will be removed from history and stats.',
  'history.all': 'All', 'history.training': 'Training', 'history.empty': 'No matches yet', 'history.emptyText': 'Finished matches will show up here.',
  'settings.appearance': 'Appearance', 'settings.system': 'System', 'settings.light': 'Light', 'settings.dark': 'Dark', 'settings.color': 'Theme color', 'settings.language': 'Language', 'settings.game': 'Game',
  'settings.caller': 'Score caller', 'settings.callerSub': 'Announces scores out loud', 'settings.defaultVoice': 'Default voice', 'settings.vibrate': 'Vibration', 'settings.hints': 'Checkout hints', 'settings.hintsSub': 'Show finishing routes at 170 and below',
  'settings.askDoubles': 'Ask darts at double', 'settings.askDoublesSub': 'For accurate checkout %', 'settings.input': 'Default input', 'settings.keypad': 'Visit total', 'settings.perDart': 'Per dart', 'settings.botSpeed': 'Bot speed', 'settings.slow': 'Slow', 'settings.normal': 'Normal', 'settings.fast': 'Fast',
  'settings.data': 'Data', 'settings.export': 'Back up', 'settings.exportSub': 'Download all players and matches as JSON', 'settings.exportBtn': 'Download', 'settings.import': 'Restore from backup', 'settings.importBtn': 'Upload', 'settings.reset': 'Reset', 'settings.resetSub': 'Delete all data',
  'settings.resetQ': 'Delete all data?', 'settings.resetText': 'Players, matches and settings will be permanently deleted. This cannot be undone.', 'settings.resetDone': 'All data deleted', 'settings.imported': 'Backup restored', 'settings.importFail': 'Invalid backup file', 'settings.about': 'A Material 3 Expressive darts scorer. Data stays on this device.',
};

const DICTS = { tr, en };

export function t(key, vars) {
  const lang = getState().settings.lang;
  let s = (DICTS[lang] && DICTS[lang][key]) ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
  return s;
}
