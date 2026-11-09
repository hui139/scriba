var WORDS_PER_MINUTE = 220

var MESSAGES = {
  'en-US': {
    'reading-time.item': '{minutes} min read',
    'reading-time.title': 'Estimated reading time at {wpm} words per minute',
    'reading-time.command': 'Reading Time: Document Summary',
    'reading-time.toast': '{words} words · about {minutes} min · {count} summaries generated'
  },
  'zh-CN': {
    'reading-time.item': '约 {minutes} 分钟',
    'reading-time.title': '按每分钟 {wpm} 词估算的阅读时间',
    'reading-time.command': '阅读时间：文档摘要',
    'reading-time.toast': '{words} 字 · 约 {minutes} 分钟 · 已生成 {count} 份摘要'
  }
}

function words(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

module.exports.activate = function activate(scriba) {
  var languageIds = Object.keys(MESSAGES)
  for (var i = 0; i < languageIds.length; i += 1) {
    scriba.i18n.registerTranslations(languageIds[i], MESSAGES[languageIds[i]])
  }

  var item = document.createElement('span')

  function render() {
    item.title = scriba.i18n.t('reading-time.title', { wpm: WORDS_PER_MINUTE })
    var text = scriba.editor.getText()
    if (!text.trim()) {
      // Hide the element entirely rather than leaving an empty span in the status bar,
      // which still takes up its gap and shows as a blank slot.
      item.textContent = ''
      item.style.display = 'none'
      return
    }
    item.style.display = ''
    var minutes = Math.max(1, Math.round(words(text) / WORDS_PER_MINUTE))
    item.textContent = scriba.i18n.t('reading-time.item', { minutes: minutes })
  }

  scriba.ui.addStatusBarItem({ id: 'reading-time.item', element: item, order: 20 })
  render()

  scriba.events.on('doc:change', render)
  scriba.i18n.onChange(render)

  scriba.commands.register({
    id: 'reading-time.summary',
    name: 'Reading Time: Document Summary',
    nameKey: 'reading-time.command',
    run: function () {
      var text = scriba.editor.getText()
      var total = words(text)
      var minutes = Math.max(1, Math.round(total / WORDS_PER_MINUTE))
      var saved = scriba.storage.get('sessions') || 0
      scriba.storage.set('sessions', saved + 1)
      scriba.ui.showToast(
        scriba.i18n.t('reading-time.toast', {
          words: total,
          minutes: minutes,
          count: saved + 1
        })
      )
    }
  })
}
