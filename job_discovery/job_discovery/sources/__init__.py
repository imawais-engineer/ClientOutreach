"""Pluggable listing sources. One module per board."""

from job_discovery.sources.ashby import AshbySource
from job_discovery.sources.efinancialcareers import EFinancialCareersSource
from job_discovery.sources.freehire import FreeHireSource
from job_discovery.sources.gcc import GccSource
from job_discovery.sources.greenhouse import GreenhouseSource
from job_discovery.sources.indeed import IndeedSource
from job_discovery.sources.jooble import JoobleSource
from job_discovery.sources.linkedin import LinkedInSource
from job_discovery.sources.michaelpage import MichaelPageSource
from job_discovery.sources.naukrigulf import NaukriGulfSource
from job_discovery.sources.upwork import UpworkSource
from job_discovery.sources.weworkremotely import WeWorkRemotelySource
from job_discovery.sources.workingnomads import WorkingNomadsSource

SOURCES = [
    LinkedInSource(),
    NaukriGulfSource(),
    EFinancialCareersSource(),
    FreeHireSource(),
    GreenhouseSource(),
    JoobleSource(),
    WorkingNomadsSource(),
    WeWorkRemotelySource(),
    AshbySource(),
    IndeedSource(),
    UpworkSource(),
    GccSource(),
    MichaelPageSource(),
]

SOURCE_BY_ID = {source.id: source for source in SOURCES}
