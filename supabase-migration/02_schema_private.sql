--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS private;


--
-- Name: can_access_zone(uuid, uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_access_zone(_uid uuid, _zone_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_main_admin(_uid)
      OR public.get_user_zone(_uid) = _zone_id
$$;


--
-- Name: get_user_zone(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.get_user_zone(_uid uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$$;


--
-- Name: has_permission(uuid, public.app_permission); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.has_permission(_user_id uuid, _permission public.app_permission) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  );
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.has_role(_uid uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND role = _role
  )
$$;


--
-- Name: is_main_admin(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_main_admin(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
$$;


--
-- Name: is_zone_admin(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_zone_admin(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$$;


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;


--
-- Name: FUNCTION can_access_zone(_uid uuid, _zone_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.can_access_zone(_uid uuid, _zone_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_access_zone(_uid uuid, _zone_id uuid) TO service_role;
GRANT ALL ON FUNCTION private.can_access_zone(_uid uuid, _zone_id uuid) TO anon;
GRANT ALL ON FUNCTION private.can_access_zone(_uid uuid, _zone_id uuid) TO authenticated;


--
-- Name: FUNCTION has_permission(_user_id uuid, _permission public.app_permission); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.has_permission(_user_id uuid, _permission public.app_permission) FROM PUBLIC;
GRANT ALL ON FUNCTION private.has_permission(_user_id uuid, _permission public.app_permission) TO service_role;


--
-- Name: FUNCTION has_role(_uid uuid, _role public.app_role); Type: ACL; Schema: private; Owner: -
--

GRANT ALL ON FUNCTION private.has_role(_uid uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION private.has_role(_uid uuid, _role public.app_role) TO service_role;


--
-- PostgreSQL database dump complete
--


