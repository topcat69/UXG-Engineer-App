-- An engineer selecting "Ethernet" as the network type had nowhere to
-- record which physical port it was patched into — WiFi's equivalent
-- follow-up field (wifi_signal) already existed, Ethernet's didn't.
alter table job_details add column network_port text;
alter table install_forms add column network_port text;
