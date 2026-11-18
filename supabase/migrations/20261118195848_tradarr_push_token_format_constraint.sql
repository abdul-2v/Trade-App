
alter table public.tradarr_push_devices
 drop constraint if exists tradarr_push_devices_expo_token_check;
alter table public.tradarr_push_devices add constraint tradarr_push_devices_expo_token_check
 check (
    length(expo_token) between 24 and 220
    and (expo_token like 'ExpoPushToken[%]' or expo_token like 'ExponentPushToken[%]')
    and length(split_part(expo_token,'[',2)) > 2
    and translate(split_part(split_part(expo_token,'[',2),']',1),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-','')=''
 );

