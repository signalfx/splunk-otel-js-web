# Cookies

Splunk Browser Agent is relying on a presence of a cookie to link traces to a session:

|Cookie|Purpose|Comment|
|---|---|---|
|`__splunk_rum_sid`|Stores session id|By default, a session lasts until there's 15 minutes passed from the last user interaction. The maximum session duration is capped to four hours.|
