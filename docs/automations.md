# Automations on top of Filippa

Filippa runs on the core `home_connect` integration, so the dishwasher's
state is already a plain entity. This is what the author runs on top of it;
it does not ship with the integration. Entity ids assume the dishwasher is
called **Filippa**; people and phones are placeholders (`person.alice` /
`person.bob`, `notify.mobile_app_alice` / `_bob`).

## Done, once, to whoever is home

`sensor.filippa_operation_state` goes `run` → `finished` at the end of a
cycle. One push, no nagging: a loaded dishwasher can wait. It goes only to
whoever is home, since away nobody can empty it; with the house empty
nobody gets it.

```yaml
- id: filippa_finita
  alias: 'Filippa: finished'
  triggers:
  - trigger: state
    entity_id: sensor.filippa_operation_state
    from: run
    to: finished
  actions:
  - repeat:
      for_each: >-
        {% set ns = namespace(l=[]) %}
        {% for p, svc in [('person.alice', 'mobile_app_alice'),
                          ('person.bob', 'mobile_app_bob')] %}
          {% if is_state(p, 'home') %}{% set ns.l = ns.l + [svc] %}{% endif %}
        {% endfor %}
        {{ ns.l }}
      sequence:
      - action: "notify.{{ repeat.item }}"
        data:
          message: Filippa is done, the dishes are clean
          data:
            tag: filippa_finita
  mode: single
```

For a washer, where wet laundry left in the drum does go bad, see the nag
in [Peppina's automations](https://github.com/vjt/peppina/blob/main/docs/automations.md):
hourly to whoever is home, critical to everyone after 6 hours.
