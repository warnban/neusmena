# Бланки журнала происшествий

Шаблоны создаются скриптом `npm run generate:incident-forms` и лежат в этой папке:

| Файл | Бланк |
|------|--------|
| `rule-violation-act.docx` | Акт о нарушении правил проживания |
| `property-damage-act.docx` | Акт о повреждении имущества |
| `guest-explanation.docx` | Объяснение гостя |

В бланк подставляются реквизиты гостиницы (`{hotel_name}`, `{hotel_legal_name}`, `{hotel_address}` и т.д.). Остальные поля заполняются от руки.
